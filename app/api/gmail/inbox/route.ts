import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // adjust if your path differs
import { getGmailClient } from "@/lib/gmail";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gmail = getGmailClient((session as any).accessToken);

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

        const subject = headers.find((h) => h.name === "Subject")?.value;
        const from = headers.find((h) => h.name === "From")?.value;

        return {
          id: msg.id,
          subject,
          from,
          snippet: detail.data.snippet,
        };
      })
    );

    return NextResponse.json({ messages: fullMessages });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed inbox fetch" }, { status: 500 });
  }
}