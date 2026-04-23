import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function stripCodeFences(raw: string) {
  let text = raw.trim();
  text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
  text = text.replace(/\s*```$/i, "");
  return text.trim();
}

function extractJsonText(raw: string) {
  const cleaned = stripCodeFences(raw);
  const start = cleaned.search(/[\{\[]/);
  if (start === -1) return null;

  const open = cleaned[start];
  const close = open === "{" ? "}" : "]";

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  return null;
}

function embedInPromptLiteral(s: string) {
  return s.replace(/`/g, "'").replace(/\$\{/g, "$\u007b");
}

function safePromptFragment(s: string, maxLen: number) {
  return embedInPromptLiteral(String(s ?? ""))
    .replace(/"/g, "'")
    .replace(/\r\n/g, " ")
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function escapeRawNewlinesInJsonStrings(json: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escape) {
      out += ch;
      escape = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString) {
      if (ch === "\n") { out += "\\n"; continue; }
      if (ch === "\r") { out += "\\r"; continue; }
      if (ch === "\t") { out += "\\t"; continue; }
    }
    out += ch;
  }
  return out;
}

function parseAiResponseJson(raw: string): Record<string, unknown> | null {
  const attempts: string[] = [];
  const extracted = extractJsonText(raw);
  if (extracted) attempts.push(extracted);
  const fenced = stripCodeFences(raw);
  if (!attempts.includes(fenced)) attempts.push(fenced);
  if (!attempts.includes(raw.trim())) attempts.push(raw.trim());

  for (const candidate of attempts) {
    try {
      const repaired = escapeRawNewlinesInJsonStrings(candidate);
      const parsed = JSON.parse(repaired) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      try {
        const parsed = JSON.parse(candidate) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        /* next */
      }
    }
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json().catch(() => ({}));

    const message =
      body && typeof body === "object" && "message" in body && typeof (body as any).message === "string"
        ? (body as any).message.trim()
        : "";

    const existingLeads = Array.isArray((body as any).existingLeads) ? (body as any).existingLeads : [];
    const attachments = Array.isArray((body as any).attachments) ? (body as any).attachments : [];

    if (!message) return NextResponse.json({ error: "No message provided" }, { status: 400 });

    // Fetch user's name and company name for drafts
    const session = await getServerSession(authOptions);
    let userCompany: string | null = null;
    let userName: string | null = null;
    if (session?.user?.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { company: true, name: true },
      });
      userCompany = dbUser?.company ?? null;
      userName = dbUser?.name ?? session.user.name ?? null;
    }

    if (!userCompany) {
      return NextResponse.json({
        reply: "⚠️ You need to set your company name in Account Settings before I can generate outreach drafts.",
        leads: [],
      });
    }

    const existingText = existingLeads.length
      ? existingLeads
          .slice(0, 50)
          .map((l: any, i: number) =>
            `${i + 1}. ${safePromptFragment(l.company || "Unknown", 120)} | ${safePromptFragment(l.website || "", 200)} | ${safePromptFragment(l.email || "", 120)}`
          )
          .join("\\n")
      : "None";

    const attachmentText = attachments.length
      ? attachments
          .map((a: any) => `${safePromptFragment(a.name || "file", 200)} (${safePromptFragment(a.url || "no-url", 500)})`)
          .join(", ")
      : "None";

    const senderName = userName || "the sender";
    const draftBodyRule = `- draft must include subject and body.\n- Subject line rules (critical): Every subject line MUST include the user's company name \"${userCompany}\". Use one of these two formats:\n  1. \"Introduction to ${userCompany} Services\"\n  2. \"Backup Carrier Options - ${userCompany}\"\n  Choose the format that best fits the email content. If the email introduces the brokerage, use format 1. If the email is about backup carrier capacity, use format 2. Always include \"${userCompany}\" in the subject line. Do NOT use any other subject line format.\n- Body: greeting, 1-2 short paragraphs about carrier capacity/backup options, clear call to action, and end with \"Best regards\" on its own line. Do NOT include a signature block (name, title, phone, email) — the user's Gmail signature is appended automatically when the email is sent. Use paragraph breaks (\\n\\n).\n- CRITICAL: The user's name is "${senderName}" and their company is "${userCompany}". You MUST use the user's actual name "${senderName}" in the email body — NEVER use [Your Name] or any placeholder. For example: "My name is ${senderName}, and I represent ${userCompany}".\n- Do NOT repeat the recipient company name in the email body after the greeting. Only use their company name once in the greeting line (e.g. "Dear Trailer Marketing Inc. Team,"). In the body paragraphs, refer to them generically (e.g. "your team", "your operations", "your dealership") — NEVER say "like Trailer Marketing Inc." or repeat their company name. Repeating the company name sounds artificial and robotic.`;

    const personalizationRule = `\\n\\nPERSONALIZATION RULES (critical — every draft must be unique):\\n- Each draft MUST reference the specific company name and mention something relevant to their business or industry. Do NOT copy the same email body across leads.\\n- Vary the greeting, opening line, value proposition, and call-to-action for each lead.\\n- If you found info about the company (industry, services, location), reference it naturally in the email.\\n- Tone: professional, warm, concise. Avoid generic phrases like "I hope this message finds you well" for every email — mix up openings.`;

    const signatureBlock = "";

    const system = `You are an AI assistant that helps freight brokers find shippers and produce professional outreach drafts. You have access to web search — USE IT to find real company websites, contact pages, and verified email addresses.\\n\\nRules:\\n- ALWAYS return valid JSON and nothing else.\\n- Top-level response must be an object: { \"reply\": string, \"leads\": array }.\\n- When asked to find leads return 3-5 leads when possible. Fewer high-quality leads are better than many incomplete ones.\\n- Each lead must include: company, website (or null), email (or null), emails (array of all verified emails found, or []), phone (or null), location (or null), commodity (or null), and draft.\\n- If a lead has NO verified email, set email to null and do NOT include a draft — instead include phone if found. These leads will be saved as prospects.\\n- If a lead HAS verified emails, include a draft as usual.\\n${draftBodyRule}\\n- If attachments are suggested, include attachments array on draft with objects: { name: string, mimeType?: string, url?: string } — include url when an uploaded attachment with that name exists.\\n- If you cannot produce leads, return leads: [] and a helpful reply.\\n\\nTARGET COMPANY RULES (critical — focus on the right size):\\n- Focus on SMALL companies with fewer than 500 employees. Prioritize small manufacturers, small shippers, and regional operators.\\n- Do NOT target large corporations (500+ employees). Small companies are more responsive and better fits for freight brokerages.\\n- When searching, include terms like \"small\", \"regional\", \"independent\", \"family-owned\" to surface smaller businesses.\\n- Also search for companies that handle HOTSHOT LOADS — expedited, time-critical freight typically moved by smaller carriers and shippers. Search for \"hotshot trucking companies\", \"hotshot freight shippers\", \"expedited freight companies\".\\n- Hotshot companies are prime targets — they frequently need brokerage support for load matching.\\n\\nWEB SEARCH & EMAIL VERIFICATION RULES (critical — you MUST search the web to find real emails):\\n- When asked to find leads, you MUST use web search to look up each company's actual website and find their real contact email.\\n- Search for each company's website, then search for their contact page, careers page, or team page to find actual email addresses.\\n- CROSS-REFERENCE emails: After finding an email on a company website, also search LinkedIn, Apollo, ZoomInfo, or other business directories to VERIFY the email and find additional contacts. Search \"[company name] LinkedIn\" and \"[company name] email contact\" to cross-reference.\\n- If you find MULTIPLE verified emails for a company, include ALL of them in the \"emails\" array. The user will choose which one to use.\\n- You MUST NOT guess, infer, or construct email addresses from patterns (e.g. do NOT assume info@company.com, sales@company.com, logistics@company.com exist just because they look plausible).\\n- ONLY use an email address if you found it explicitly on the company's actual website, LinkedIn, or another trusted source via web search.\\n- If your web search did not find a specific email on their site or LinkedIn, set the email field to null and emails to []. It is far better to return null than a wrong email that will bounce.\\n- When you DO find a real email, prefer in this order: 1) logistics/shipping/dispatch/transportation addresses, 2) operations/warehouse/supplychain addresses, 3) named person emails from Contact/Team or LinkedIn pages, 4) info/sales/contact as last resort — but ONLY if you actually saw that exact address on a trusted source.\\n- If no verified email exists, find the company's phone number instead and include it in the phone field. These leads will be saved as prospects for phone outreach.\\n- Always include the company's actual website URL when found via web search.\\n\\nDEDUPLICATION RULES:\\n- Do NOT return any lead whose company name or email matches one in the 'Existing leads' list below — even if the company was already contacted under a different email, skip the entire company.\\n- The existing leads list includes both current drafts AND companies that have already been sent emails. You MUST skip all of them.${personalizationRule}${signatureBlock}\\n\\nExisting leads (DO NOT repeat any of these):\\n${existingText}\\n\\nAttachments the user uploaded (mention relevant ones in drafts): ${attachmentText}`;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0.25,
      max_output_tokens: 16000,
      input: [
        { role: "system", content: system },
        { role: "user", content: message },
      ],
      tools: [{ type: "web_search" }],
    });

    // Extract text and web search activity from Responses API output
    let raw = "";
    const searchSteps: { query: string; status: string }[] = [];
    for (const item of response.output) {
      if (item.type === "web_search_call") {
        const ws = item as any;
        searchSteps.push({ query: ws.query || ws.action?.query || "Searching the web...", status: ws.status || "completed" });
      }
      if (item.type === "message" && Array.isArray((item as any).content)) {
        for (const block of (item as any).content) {
          if (block.type === "output_text" && typeof block.text === "string") {
            raw += block.text;
          }
        }
      }
    }
    raw = raw.trim();
    console.log("OPENAI RAW RESPONSE (first 500 chars):", raw.slice(0, 500));
    console.log("OPENAI SEARCH STEPS:", JSON.stringify(searchSteps));

    // Try parsing — escape raw newlines first since the model often puts literal \n in JSON strings
    let parsed: Record<string, unknown> | null = null;
    const escaped = escapeRawNewlinesInJsonStrings(raw);
    try {
      const direct = JSON.parse(escaped);
      if (direct && typeof direct === "object" && !Array.isArray(direct)) {
        parsed = direct as Record<string, unknown>;
        console.log("OPENAI: direct JSON.parse succeeded");
      }
    } catch (e) {
      console.log("OPENAI: direct JSON.parse failed:", e instanceof Error ? e.message : String(e));
    }

    if (!parsed) {
      parsed = parseAiResponseJson(raw);
      if (parsed) console.log("OPENAI: parseAiResponseJson succeeded");
    }

    // Last resort: try to extract just the leads array with regex if JSON is truncated
    if (!parsed && raw.includes('"leads"')) {
      console.log("OPENAI: trying truncated JSON recovery...");
      try {
        const leadsMatch = raw.match(/"leads"\s*:\s*\[/);
        if (leadsMatch) {
          // Find the leads array start and try to parse individual lead objects
          const leadsStart = raw.indexOf(leadsMatch[0]);
          const leadsJson = raw.slice(leadsStart + leadsMatch[0].length - 1);
          // Try to close the array manually
          let partial = leadsJson;
          const lastBrace = partial.lastIndexOf('}');
          if (lastBrace > 0) {
            partial = partial.slice(0, lastBrace + 1) + ']';
            const leadsArr = JSON.parse(escapeRawNewlinesInJsonStrings(partial));
            if (Array.isArray(leadsArr) && leadsArr.length > 0) {
              parsed = { reply: `Found ${leadsArr.length} leads (response was partially recovered).`, leads: leadsArr };
              console.log("OPENAI: truncated recovery succeeded, found", leadsArr.length, "leads");
            }
          }
        }
      } catch (e2) {
        console.log("OPENAI: truncated recovery failed:", e2 instanceof Error ? e2.message : String(e2));
      }
    }

    if (parsed) {
      return NextResponse.json({
        reply: typeof parsed.reply === "string" ? parsed.reply : "Done.",
        leads: Array.isArray(parsed.leads) ? parsed.leads : [],
        searchSteps,
      });
    }

    console.error("OPENAI: all parsing failed, returning raw text as reply");
    return NextResponse.json({ reply: raw || "No response from AI", leads: [], searchSteps });
  } catch (err: unknown) {
    console.error("OPENAI ERROR:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "AI failed" }, { status: 500 });
  }
}
