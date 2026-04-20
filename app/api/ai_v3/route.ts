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

function safeParseJSON(raw: string) {
  try {
    const jsonText = extractJsonText(raw);
    if (!jsonText) return null;
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
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
      ? existingLeads.slice(0, 50).map((l: any, i: number) => `${i + 1}. ${l.company || "Unknown"} | ${l.website || ""} | ${l.email || ""}`).join("\\n")
      : "None";

    const attachmentText = attachments.length
      ? attachments.map((a: any) => `${a.name} (${a.url || "no-url"})`).join(", ")
      : "None";

    const system = `You are an AI assistant that helps freight brokers find shippers and produce professional outreach drafts.\\n\\nRules:\\n- ALWAYS return valid JSON and nothing else.\\n- Top-level response must be an object: { \"reply\": string, \"leads\": array }.\\n- When asked to find leads return 3-10 leads when possible.\\n- Each lead must include: company, website (or null), email (or null), location (or null), and draft.\\n- draft must include subject and body. Body MUST be a polished, formal email with a greeting, 1-2 short paragraphs, a clear call to action, and a professional signature (name and contact). Use paragraph breaks (\\\\n\\\\n).\\n- If attachments are suggested, include attachments array on draft with objects: { name: string, mimeType?: string, url?: string } — include url when an uploaded attachment with that name exists.\\n- If you cannot produce leads, return leads: [] and a helpful reply.\\n\\nReference style (tone and formatting):\\nHey Team,\\\\n\\\\nI hope this message finds you well. I wanted to take a moment to introduce Haulora Freight and share our company information with you.\\\\n\\\\nWe work with a network of reliable carriers across step deck, flatbed, and open-deck freight, and our focus is helping businesses like yours keep their shipments moving smoothly. Whether it’s last-minute loads, challenging lanes, or consistent freight.\\\\n\\\\nI’ve attached our information for your review. Please feel free to reach out at any time by email or directly on my cell at (903) 277-7030. I’d be happy to discuss how we can support your logistics needs and provide dependable capacity whenever you need it.\\\\n\\\\nThank you for your time, and I look forward to the opportunity to work with your team.\\\\n\\\\nBest regards,\\\\n\\\\nAustin\\n\\nExisting leads:\\n${existingText}\\n\\nUploaded attachments:\\n${attachmentText}\\n\\nRespond ONLY with JSON containing reply and leads. Do not wrap in markdown.`;

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

    const parsed = safeParseJSON(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return NextResponse.json({ reply: typeof (parsed as any).reply === "string" ? (parsed as any).reply : "Done.", leads: Array.isArray((parsed as any).leads) ? (parsed as any).leads : [] });
    }

    return NextResponse.json({ reply: raw || "No response from AI", leads: [] });
  } catch (err: unknown) {
    console.error("AI V3 ERROR:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "AI failed" }, { status: 500 });
  }
}
