import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailClient } from "@/lib/gmail";

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function extractBody(payload: any): string {
  if (payload.body?.data) {
    const mime = (payload.mimeType || "").toLowerCase();
    if (mime === "text/html") return decodeBase64Url(payload.body.data);
    if (mime === "text/plain") return `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(decodeBase64Url(payload.body.data))}</pre>`;
    return decodeBase64Url(payload.body.data);
  }
  const parts = payload.parts || [];
  let htmlBody = "";
  let plainBody = "";
  for (const part of parts) {
    const mime = (part.mimeType || "").toLowerCase();
    if (mime === "text/html" && part.body?.data) {
      htmlBody = decodeBase64Url(part.body.data);
    }
    if (mime === "text/plain" && part.body?.data) {
      plainBody = decodeBase64Url(part.body.data);
    }
    if (mime.startsWith("multipart/") && part.parts) {
      const nested = extractBody(part);
      if (nested && !htmlBody) htmlBody = nested;
    }
  }
  if (htmlBody) return htmlBody;
  if (plainBody) return `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(plainBody)}</pre>`;
  return "";
}

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
          format: "full",
        });

        const headers = detail.data.payload?.headers || [];

        const subject = headers.find((h) => h.name === "Subject")?.value;
        const to = headers.find((h) => h.name === "To")?.value;

        const dateHeader = headers.find((h) => h.name === "Date")?.value || null;

        return {
          id: msg.id,
          subject,
          to,
          snippet: detail.data.snippet,
          body: extractBody(detail.data.payload),
          time: dateHeader,
        };
      })
    );

    return NextResponse.json({ messages: fullMessages });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed sent fetch" }, { status: 500 });
  }
}