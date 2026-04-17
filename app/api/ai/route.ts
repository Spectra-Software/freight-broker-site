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
      messages: [
        {
          role: "system",
          content: `
You are an AI assistant for a freight broker SaaS platform.

Your job is to:
- Find shipping leads
- Suggest companies
- Help write outreach emails
- Assist with logistics strategy

IMPORTANT FORMATTING RULES:
- Use clear section headers (## Title)
- Use bullet points (- item)
- Keep responses clean and scannable
- Avoid large paragraphs
- Group companies by city when relevant
- Add short labels (e.g., "ExxonMobil — Energy")

DO NOT return long messy blocks of text.
Always format for a dashboard UI.
`,
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.7,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "No response from AI";

    return NextResponse.json({ reply });
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