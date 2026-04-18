import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "No message provided" },
        { status: 400 }
      );
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `
You are an AI assistant for a freight broker SaaS platform.

You must return JSON ONLY when generating leads.

WHEN USER ASKS FOR SHIPPERS / LEADS:
Return this exact JSON structure:

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
        "body": "Full outreach email",
        "attachments": [
          {
            "name": "capabilities.pdf",
            "type": "application/pdf"
          }
        ]
      }
    }
  ]
}

RULES:
- Always include at least 3-10 leads when possible
- Emails should be realistic formats
- Keep outreach emails short, professional, and persuasive
- Mention freight/logistics value
- DO NOT include explanations outside JSON
- reply field should still be human-readable summary

IF NOT A LEAD REQUEST:
Return:
{
  "reply": "normal formatted answer"
}
`,
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const raw =
      completion.choices?.[0]?.message?.content?.trim() ||
      "";

    let parsed: any = null;

    try {
      parsed = JSON.parse(raw);
    } catch {
      // fallback if model returns text instead of JSON
      return NextResponse.json({
        reply: raw || "No response from AI",
      });
    }

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("GROQ ERROR:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "AI failed to respond. Check server logs.",
      },
      { status: 500 }
    );
  }
}