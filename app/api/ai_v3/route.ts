import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

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
    if (ch === '\"') { inString = !inString; continue; }
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

/** Avoid raw double-quotes / newlines in free-text blocks so the model is not steered into invalid JSON. */
function safePromptFragment(s: string, maxLen: number) {
  return embedInPromptLiteral(String(s ?? ""))
    .replace(/"/g, "'")
    .replace(/\r\n/g, " ")
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/**
 * JSON.parse often fails on LLM output when string values contain literal newlines.
 * Escape those only while inside a double-quoted string (respect \\ and \").
 */
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
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
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
    const draftBodyRule = `- draft must include subject and body.\n- Subject line rules (critical): Every subject line MUST include the user's company name \"${userCompany}\". Use one of these two formats:\n  1. \"Introduction to ${userCompany} Services\"\n  2. \"Backup Carrier Options - ${userCompany}\"\n  Choose the format that best fits the email content. If the email introduces the brokerage, use format 1. If the email is about backup carrier capacity, use format 2. Always include \"${userCompany}\" in the subject line. Do NOT use any other subject line format.\n- Body: greeting, 1-2 short paragraphs about carrier capacity/backup options, clear call to action, and end with \"Best regards\" on its own line. Do NOT include a signature block (name, title, phone, email) — the user's Gmail signature is appended automatically when the email is sent. Use paragraph breaks (\\n\\n).\n- CRITICAL: The user's name is \"${senderName}\" and their company is \"${userCompany}\". You MUST use the user's actual name \"${senderName}\" in the email body — NEVER use [Your Name] or any placeholder. For example: \"My name is ${senderName}, and I represent ${userCompany}\".`;

    const personalizationRule = `\\n\\nPERSONALIZATION RULES (critical — every draft must be unique):\\n- Each draft MUST reference the specific company name and mention something relevant to their business or industry. Do NOT copy the same email body across leads.\\n- Vary the greeting, opening line, value proposition, and call-to-action for each lead.\\n- If you found info about the company (industry, services, location), reference it naturally in the email.\\n- Tone: professional, warm, concise. Avoid generic phrases like "I hope this message finds you well" for every email — mix up openings.`;

    const signatureBlock = "";

    const system = `You are an AI assistant that helps freight brokers find shippers and produce professional outreach drafts.\\n\\nRules:\\n- ALWAYS return valid JSON and nothing else.\\n- Top-level response must be an object: { \"reply\": string, \"leads\": array }.\\n- When asked to find leads return 3-10 leads when possible.\\n- Each lead must include: company, website (or null), email (or null), location (or null), and draft.\\n${draftBodyRule}\\n- If attachments are suggested, include attachments array on draft with objects: { name: string, mimeType?: string, url?: string } — include url when an uploaded attachment with that name exists.\\n- If you cannot produce leads, return leads: [] and a helpful reply.\\n\\nEMAIL VERIFICATION RULES (critical — wrong emails will bounce and damage sender reputation):\\n- You MUST NOT guess, infer, or construct email addresses from patterns (e.g. do NOT assume info@company.com, sales@company.com, logistics@company.com exist just because they look plausible).\\n- ONLY use an email address if you have seen it explicitly listed on the company's actual website, in a verified directory, or in reliable public data.\\n- If you have NOT seen the exact email on the company's site or a trusted source, set the email field to null. It is far better to return null than a wrong email.\\n- When you DO find a real email on a company's website, prefer in this order: 1) logistics/shipping/dispatch/transportation addresses, 2) operations/warehouse/supplychain addresses, 3) named person emails from Contact/Team pages, 4) info/sales/contact as last resort — but ONLY if you actually saw that exact address on their site.\\n- If no verified email exists, include the company's website URL and set email to null. The user can look up the contact themselves.\\n\\nDEDUPLICATION RULES:\\n- Do NOT return any lead whose company name or email matches one in the 'Existing leads' list below — even if the company was already contacted under a different email, skip the entire company.\\n- The existing leads list includes both current drafts AND companies that have already been sent emails. You MUST skip all of them.${personalizationRule}${signatureBlock}\\n\\nExisting leads (DO NOT repeat any of these companies):\\n${existingText}\\n\\nUploaded attachments:\\n${attachmentText}\\n\\nRespond ONLY with JSON containing reply and leads. Do not wrap in markdown.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.25,
      messages: [
        { role: "system", content: system },
        { role: "user", content: message },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    console.log("AI V3 RAW RESPONSE:", raw);

    const parsed = parseAiResponseJson(raw);
    if (parsed) {
      return NextResponse.json({
        reply: typeof parsed.reply === "string" ? parsed.reply : "Done.",
        leads: Array.isArray(parsed.leads) ? parsed.leads : [],
      });
    }

    return NextResponse.json({ reply: raw || "No response from AI", leads: [] });
  } catch (err: unknown) {
    console.error("AI V3 ERROR:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "AI failed" }, { status: 500 });
  }
}
