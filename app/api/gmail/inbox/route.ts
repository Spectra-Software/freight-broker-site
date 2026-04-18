import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailClient } from "@/lib/gmail";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    // 🔍 DEBUG (check Vercel logs)
    console.log("SESSION:", session);

    if (!session) {
      return NextResponse.json(
        { error: "No session found" },
        { status: 401 }
      );
    }

    const accessToken = (session as any).accessToken;

    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token on session" },
        { status: 401 }
      );
    }

    const gmail = getGmailClient(accessToken);

    const messages = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
      q: "in:inbox",
    });

    const fullMessages = await Promise.all(
      (messages.data.messages || []).map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
        });

        const headers = detail.data.payload?.headers || [];

        const subject =
          headers.find((h) => h.name === "Subject")?.value || "(No Subject)";
        const from =
          headers.find((h) => h.name === "From")?.value || "(Unknown Sender)";

        return {
          id: msg.id,
          subject,
          from,
          snippet: detail.data.snippet,
        };
      })
    );

    return NextResponse.json({ messages: fullMessages });
  } catch (err: any) {
    console.error("GMAIL INBOX ERROR:", err?.response?.data || err);

    // 🔥 Handle expired/invalid token cleanly
    if (err?.response?.status === 401) {
      return NextResponse.json(
        { error: "Gmail unauthorized (token expired or invalid)" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed inbox fetch" },
      { status: 500 }
    );
  }
}