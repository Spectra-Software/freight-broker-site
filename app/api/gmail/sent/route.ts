import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
      q: "in:sent",
    });

    const fullMessages = await Promise.all(
      (messages.data.messages || []).map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
        });

        const headers = detail.data.payload?.headers || [];

        const subject = headers.find((h) => h.name === "Subject")?.value;
        const to = headers.find((h) => h.name === "To")?.value;

        return {
          id: msg.id,
          subject,
          to,
          snippet: detail.data.snippet,
        };
      })
    );

    return NextResponse.json({ messages: fullMessages });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed sent fetch" }, { status: 500 });
  }
}