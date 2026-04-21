import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailClient } from "@/lib/gmail";

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractBody(payload: any): string {
  // If the payload has direct body data (simple text/plain or text/html)
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  // Recursively search MIME parts for text/plain first, then text/html
  const parts = payload.parts || [];
  let htmlBody = "";
  for (const part of parts) {
    const mime = (part.mimeType || "").toLowerCase();
    if (mime === "text/plain" && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
    if (mime === "text/html" && part.body?.data) {
      htmlBody = decodeBase64Url(part.body.data);
    }
    // Check nested multipart
    if (mime.startsWith("multipart/") && part.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return htmlBody;
}

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
        const dateHeader = headers.find((h) => h.name === "Date")?.value || null;

        return {
          id: msg.id,
          subject,
          from,
          snippet: detail.data.snippet,
          body: extractBody(detail.data.payload),
          time: dateHeader,
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