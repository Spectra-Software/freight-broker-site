import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    // Fetch user's company name for subject lines
    const session = await getServerSession(authOptions);
    let userCompany: string | null = null;
    if (session?.user?.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { company: true },
      });
      userCompany = dbUser?.company ?? null;
    }

    if (!userCompany) {
      return NextResponse.json({
        reply: "⚠️ You need to set your company name in Account Settings before I can generate outreach drafts. Please go to Settings → Profile → Company and add your company name, then try again.",
        leads: [],
      });
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
- Do not repeat any lead that already appears in the existing leads list — even if a different email was used, skip the entire company.
- The existing leads list includes both current drafts AND companies that have already been sent emails. You MUST skip all of them.
- If the user asks for shippers/leads, return 3 to 10 leads when possible.
- Keep outreach emails short, professional, and persuasive. Format them with a brief greeting, 1-2 short paragraphs stating the value for freight/logistics, a clear call-to-action, and end with "Best regards" on its own line. Do NOT include a signature block (name, title, phone, email) — the user's Gmail signature is appended automatically when the email is sent.
- Subject line rules (critical): Every subject line MUST include the user's company name "${userCompany}". Use one of these two formats: 1. "Introduction to ${userCompany} Services" or 2. "Backup Carrier Options - ${userCompany}". Choose the format that best fits the email content. If the email introduces the brokerage, use format 1. If the email is about backup carrier capacity, use format 2. Always include "${userCompany}" in the subject line. Do NOT use any other subject line format.
- Mention freight / logistics value and a clear next step.
- The reply field must be human-readable and concise.
- PERSONALIZATION: Each draft MUST reference the specific company name and mention something relevant to their business. Do NOT copy the same email body across leads. Vary the greeting, opening line, value proposition, and call-to-action for each lead. Avoid generic phrases like "I hope this message finds you well" for every email — mix up openings.

EMAIL PRIORITY RULES (critical for freight broker outreach):
- When finding emails for a company, prioritize logistics/shipping-specific addresses in this order:
  1. logistics@, shipping@, dispatch@, transportation@, freight@, traffic@ — these are the most relevant contacts for freight brokers
  2. operations@, ops@, warehouse@, supplychain@ — operational contacts
  3. Contact form URLs or specific person emails found on the company's 'Contact Us' or 'Careers' page
  4. info@, sales@, contact@ — only as a last resort when no logistics-specific email exists
- NEVER make up or guess email addresses. Only use emails you are confident exist based on common patterns or known company data.
- If you cannot find a logistics-specific email, prefer the company's website contact page URL over a generic email.

Important: ALWAYS return valid JSON. If you cannot produce valid JSON for any reason, return a JSON object with a single "reply" field explaining the issue. Do not output anything that is not parseable JSON. Ensure strings are properly quoted and do not include trailing commentary.

Existing leads already contacted (DO NOT repeat any of these companies):
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
        "subject": "Introduction to ${userCompany} Services",
        "body": "Full outreach email (greeting, 1-2 short paragraphs, CTA, end with Best regards — no signature block)",
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