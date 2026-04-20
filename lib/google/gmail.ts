import { google } from "googleapis";

// =========================
// OAUTH CLIENT (FIXED)
// =========================
function getOAuthClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return oauth2Client;
}

function getGmail(accessToken: string) {
  return google.gmail({
    version: "v1",
    auth: getOAuthClient(accessToken),
  });
}

// =========================
// 🔥 SEND EMAIL (PRODUCTION SAFE)
// =========================
export async function sendEmail({
  accessToken,
  to,
  subject,
  body,
  attachments = [],
}: {
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  attachments?: {
    name: string;
    url?: string;
    mimeType?: string;
  }[];
}) {
  const gmail = getGmail(accessToken);

  async function getGmailSignature(): Promise<string | null> {
    try {
      // gmail.users.settings.sendAs requires the gmail.settings.basic scope; may fail if not granted
      const res = await gmail.users.settings.sendAs.list({ userId: "me" as any });
      const sendAs = res.data.sendAs || [];
      const primary = sendAs.find((s: any) => s.isPrimary) || sendAs[0];
      if (primary && primary.signature) return primary.signature as string;
    } catch (e) {
      // ignore errors (likely missing scope)
      console.warn("Could not fetch Gmail signature", e);
    }
    return null;
  }

  // =========================
  // FETCH ATTACHMENTS SAFELY
  // =========================
  const files = await Promise.all(
    attachments.map(async (file) => {
      if (!file.url) return null;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s limit

        const res = await fetch(file.url, {
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) return null;

        const buffer = await res.arrayBuffer();

        // Gmail-safe size guard (10MB per file)
        if (buffer.byteLength > 10 * 1024 * 1024) {
          console.warn("ATTACHMENT TOO LARGE:", file.name);
          return null;
        }

        return {
          filename: file.name,
          mimeType: file.mimeType || "application/pdf",
          content: Buffer.from(buffer).toString("base64"),
        };
      } catch (err) {
        console.error("ATTACHMENT FETCH FAILED:", file.url);
        return null;
      }
    })
  );

  const validFiles = files.filter(Boolean) as {
    filename: string;
    mimeType: string;
    content: string;
  }[];

  const boundary = "----=_Part_" + Date.now();
  const parts: string[] = [];

  // Build multipart/alternative for plain text and HTML body inside multipart/mixed
  const altBoundary = "----=_Alt_" + Date.now();

  // sanitize and convert plain text body to HTML
  function escapeHtml(s: string) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const plainText = typeof body === "string" ? body : "";
  const htmlBody = (async () => {
    const text = plainText.trim();
    // Normalize newlines
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    // Split on double newlines for paragraphs
    const paragraphs = normalized.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const escaped = paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`).join("\n\n");
    // attempt to append Gmail signature (HTML) when available
    const signatureHtml = await getGmailSignature();
    const withSig = signatureHtml ? `${escaped}<br/>${signatureHtml}` : escaped;
    return `<!DOCTYPE html><html><body>${withSig}</body></html>`;
  })();

  // multipart/alternative part
  parts.push(`--${boundary}`);
  parts.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
  parts.push("");

  // plain text part
  parts.push(`--${altBoundary}`);
  parts.push("Content-Type: text/plain; charset=UTF-8");
  parts.push("Content-Transfer-Encoding: 7bit");
  parts.push("");
  parts.push(plainText);

  // html part
  parts.push(`--${altBoundary}`);
  parts.push("Content-Type: text/html; charset=UTF-8");
  parts.push("Content-Transfer-Encoding: 7bit");
  parts.push("");
  // htmlBody may be a promise if signature fetch was attempted
  parts.push(typeof htmlBody === "string" ? htmlBody : await htmlBody);

  // end alt
  parts.push(`--${altBoundary}--`);

  // attachments (if any)
  for (const file of validFiles) {
    parts.push(`--${boundary}`);
    parts.push(`Content-Type: ${file.mimeType}; name="${file.filename}"`);
    parts.push("Content-Transfer-Encoding: base64");
    parts.push(`Content-Disposition: attachment; filename="${file.filename}"`);
    parts.push("");
    parts.push(file.content);
  }

  // final boundary
  parts.push(`--${boundary}--`);

  const rawMessage = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary=\"${boundary}\"`,
    "",
    parts.join("\r\n"), // CRLF
  ].join("\r\n");

  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });
}

// =========================
// INBOX
// =========================
export async function fetchInbox(accessToken: string) {
  const gmail = getGmail(accessToken);

  const res = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
    maxResults: 20,
  });

  const messages = res.data.messages || [];

  return Promise.all(
    messages.map(async (m) => {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
      });

      return full.data;
    })
  );
}

// =========================
// SENT MAIL
// =========================
export async function fetchSent(accessToken: string) {
  const gmail = getGmail(accessToken);

  const res = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["SENT"],
    maxResults: 20,
  });

  const messages = res.data.messages || [];

  return Promise.all(
    messages.map(async (m) => {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
      });

      return full.data;
    })
  );
}