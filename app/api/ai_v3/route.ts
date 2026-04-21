import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

    const draftBodyRule = `- draft must include subject and body. Body: greeting, 1-2 short paragraphs, clear call to action, and end with "Best regards" on its own line. Do NOT include a signature block (name, title, phone, email) — the user's Gmail signature is appended automatically when the email is sent. Use paragraph breaks (\\n\\n).`;

    const personalizationRule = `\\n\\nPERSONALIZATION RULES (critical — every draft must be unique):\\n- Each draft MUST reference the specific company name and mention something relevant to their business or industry. Do NOT copy the same email body across leads.\\n- Vary the greeting, opening line, value proposition, and call-to-action for each lead.\\n- If you found info about the company (industry, services, location), reference it naturally in the email.\\n- Tone: professional, warm, concise. Avoid generic phrases like "I hope this message finds you well" for every email — mix up openings.`;

    const signatureBlock = "";

    const system = `You are an AI assistant that helps freight brokers find shippers and produce professional outreach drafts.\\n\\nRules:\\n- ALWAYS return valid JSON and nothing else.\\n- Top-level response must be an object: { \"reply\": string, \"leads\": array }.\\n- When asked to find leads return 3-10 leads when possible.\\n- Each lead must include: company, website (or null), email (or null), location (or null), and draft.\\n${draftBodyRule}\\n- If attachments are suggested, include attachments array on draft with objects: { name: string, mimeType?: string, url?: string } — include url when an uploaded attachment with that name exists.\\n- If you cannot produce leads, return leads: [] and a helpful reply.\\n\\nEMAIL PRIORITY RULES (critical for freight broker outreach):\\n- When finding emails for a company, prioritize logistics/shipping-specific addresses in this order:\\n  1. logistics@, shipping@, dispatch@, transportation@, freight@, traffic@ — these are the most relevant contacts for freight brokers\\n  2. operations@, ops@, warehouse@, supplychain@ — operational contacts\\n  3. Contact form URLs or specific person emails found on the company's 'Contact Us' or 'Careers' page\\n  4. info@, sales@, contact@ — only as a last resort when no logistics-specific email exists\\n- NEVER make up or guess email addresses. Only use emails you are confident exist based on common patterns or known company data.\\n- If you cannot find a logistics-specific email, prefer the company's website contact page URL over a generic email.\\n\\nDEDUPLICATION RULES:\\n- Do NOT return any lead whose company name or email matches one in the 'Existing leads' list below — even if the company was already contacted under a different email, skip the entire company.\\n- The existing leads list includes both current drafts AND companies that have already been sent emails. You MUST skip all of them.${personalizationRule}${signatureBlock}\\n\\nExisting leads (DO NOT repeat any of these companies):\\n${existingText}\\n\\nUploaded attachments:\\n${attachmentText}\\n\\nRespond ONLY with JSON containing reply and leads. Do not wrap in markdown.`;

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
