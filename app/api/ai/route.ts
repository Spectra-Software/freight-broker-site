import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

type ExistingLead = {
  company?: string;
  website?: string;
  email?: string;
};

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

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        return cleaned.slice(start, i + 1);
      }
    }
  }

  return null;
}

function safeParseJSON(raw: string) {
  try {
    const jsonText = extractJsonText(raw);
    if (!jsonText) return null;

    return JSON.parse(jsonText);
  } catch (e) {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json().catch(() => ({}));

    const message =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message?: unknown }).message === "string"
        ? ((body as { message: string }).message.trim())
        : "";

    const existingLeads: ExistingLead[] =
      body &&
      typeof body === "object" &&
      "existingLeads" in body &&
      Array.isArray((body as { existingLeads?: unknown }).existingLeads)
        ? ((body as { existingLeads: ExistingLead[] }).existingLeads)
        : [];

    if (!message) {
      return NextResponse.json({ error: "No message provided" }, { status: 400 });
    }

    const existingLeadText =
      existingLeads.length > 0
        ? existingLeads
            .slice(0, 50)
            .map((lead: ExistingLead, index: number) => {
              return `${index + 1}. ${lead.company || "Unknown company"} | ${lead.website || "No website"} | ${lead.email || "No email"}`;
            })
            .join("\n")
        : "None";

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `
You are an AI assistant for a freight broker SaaS platform.

You help find shippers and generate outreach drafts.

Important rules:
- Return JSON ONLY.
- Do not wrap the response in markdown fences.
- Do not repeat any lead that already appears in the existing leads list.
- If the user asks for shippers/leads, return 3 to 10 leads when possible.
- Keep outreach emails short, professional, and persuasive. Format them with a brief greeting, 1-2 short paragraphs stating the value for freight/logistics, a clear call-to-action, and a professional signature (name + company).
- Use concise subject lines (4-10 words) that clearly reference freight/logistics.
- Mention freight / logistics value and a clear next step.
- Email addresses should look realistic.
- The reply field must be human-readable and concise.

Important: ALWAYS return valid JSON. If you cannot produce valid JSON for any reason, return a JSON object with a single "reply" field explaining the issue. Do not output anything that is not parseable JSON. Ensure strings are properly quoted and do not include trailing commentary.

Existing leads already on screen:
${existingLeadText}

If this is a lead request, return exactly this structure:
{
  "reply": "clean formatted summary for UI",
  "leads": [
    {
      "company": "Company Name",
      "website": "https://...",
      "email": "contact@company.com",
      "location": "City, State",
      "draft": {
        "subject": "Email subject line",
        "body": "Full outreach email (greeting, 1-2 short paragraphs, CTA, signature)",
        "attachments": [
          {
            "name": "capabilities.pdf",
            "mimeType": "application/pdf"
          }
        ]
      }
    }
  ]
}

If this is not a lead request, return:
{
  "reply": "normal formatted answer"
}
          `.trim(),
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    console.log("AI RAW RESPONSE:", raw);
    const parsed = safeParseJSON(raw);

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return NextResponse.json({
        reply: typeof (parsed as any).reply === "string" ? (parsed as any).reply : "Done.",
        leads: Array.isArray((parsed as any).leads) ? (parsed as any).leads : [],
      });
    }

    // Fallback: ALWAYS include leads (empty array when AI response couldn't be parsed)
    return NextResponse.json({
      reply: raw || "No response from AI",
      leads: [],
    });
  } catch (error: unknown) {
    console.error("GROQ ERROR:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI failed to respond. Check server logs.",
      },
      { status: 500 }
    );
  }
}