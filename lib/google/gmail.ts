import fs from "fs";
import os from "os";
import path from "path";
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

/** Primary send-as HTML signature from Gmail settings (requires Gmail API scopes). */
export async function fetchGmailSignatureHtml(accessToken: string): Promise<string | null> {
  try {
    const gmail = getGmail(accessToken);
    const res = await gmail.users.settings.sendAs.list({ userId: "me" as any });
    const sendAs = res.data.sendAs || [];
    const primary = sendAs.find((s: any) => s.isPrimary) || sendAs[0];
    if (primary?.signature) return String(primary.signature).trim() || null;
  } catch (e) {
    console.warn("Could not fetch Gmail signature", e);
  }
  return null;
}

/** Plain-text approximation of a Gmail HTML signature (for prompts / previews). */
export function gmailSignatureHtmlToPlainText(html: string): string {
  if (!html) return "";
  let s = html.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/<\/(div|p|h[1-6]|tr|blockquote)>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/&nbsp;/gi, " ");
  s = s.replace(/&amp;/g, "&");
  s = s.replace(/&lt;/g, "<");
  s = s.replace(/&gt;/g, ">");
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&#39;/g, "'");
  s = s.replace(/&#(\d+);/g, (_, n) => {
    const code = parseInt(n, 10);
    return Number.isFinite(code) ? String.fromCharCode(code) : _;
  });
  return s
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForSigCompare(s: string) {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00a0/g, " ");
}

function normalizeLooseLine(s: string) {
  return normalizeForSigCompare(s).replace(/\s+/g, " ").trim();
}

/** If the last N lines of body match the signature line-by-line (spacing-tolerant), strip them. */
function stripByTrailingLines(body: string, signaturePlain: string): string | null {
  const sigLines = signaturePlain
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!sigLines.length) return null;

  const b = normalizeForSigCompare(body).trimEnd();
  const bodyLines = b.split("\n");
  const tailLen = sigLines.length;
  if (bodyLines.length < tailLen) return null;

  const tail = bodyLines.slice(-tailLen);
  for (let i = 0; i < tailLen; i++) {
    if (normalizeLooseLine(tail[i] ?? "") !== normalizeLooseLine(sigLines[i] ?? "")) {
      return null;
    }
  }
  return bodyLines.slice(0, -tailLen).join("\n").trimEnd();
}

/** Remove trailing plain-text signature so it is not duplicated when HTML signature is appended on send. */
function stripTrailingPlainSignature(body: string, signaturePlain: string): string {
  const sig = normalizeForSigCompare(signaturePlain).trim();
  if (!sig) return body;

  let b = normalizeForSigCompare(body);
  // Pass 1: exact full-text suffix (handles verbatim AI copy)
  for (;;) {
    const t = b.trimEnd();
    if (!t.endsWith(sig)) break;
    b = t.slice(0, t.length - sig.length).trimEnd();
  }
  // Pass 2: line-based match when spacing/newlines differ slightly from HTML→plain conversion
  const lineStripped = stripByTrailingLines(b, sig);
  if (lineStripped !== null && lineStripped.length < b.length) {
    b = lineStripped;
  }
  return b.trimEnd();
}

/** Server-side fetch needs an absolute URL when the DB stores a site-relative path. */
function resolveAttachmentFetchUrl(fileUrl: string): string {
  const u = fileUrl.trim();
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/")) {
    const base = process.env.NEXTAUTH_URL || process.env.VERCEL_URL;
    if (base) {
      const origin = base.startsWith("http") ? base.replace(/\/$/, "") : `https://${base.replace(/\/$/, "")}`;
      return `${origin}${u}`;
    }
  }
  return u;
}

function uploadPathnameOnly(fileUrl: string): string {
  const u = fileUrl.trim();
  try {
    if (/^https?:\/\//i.test(u)) return new URL(u).pathname;
  } catch {
    /* ignore */
  }
  return u.startsWith("/") ? u : `/${u}`;
}

/**
 * Read files from this app's upload dirs (avoids server-side fetch() with relative URLs,
 * which fails in Node when NEXTAUTH_URL is unset).
 */
function safeDecodePathSegment(seg: string) {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

function tryReadUploadFromDisk(fileUrl: string): Buffer | null {
  const pathname = uploadPathnameOnly(fileUrl);
  let filename: string | null = null;
  const m1 = pathname.match(/^\/uploads\/(.+)$/);
  const m2 = pathname.match(/^\/api\/uploads\/files\/(.+)$/);
  if (m1) filename = safeDecodePathSegment(m1[1]);
  else if (m2) filename = safeDecodePathSegment(m2[1]);
  if (!filename || filename.includes("..")) return null;

  const publicPath = path.join(process.cwd(), "public", "uploads", filename);
  try {
    if (fs.existsSync(publicPath)) return fs.readFileSync(publicPath);
  } catch {
    /* continue */
  }
  const tmpPath = path.join(os.tmpdir(), filename);
  try {
    if (fs.existsSync(tmpPath)) return fs.readFileSync(tmpPath);
  } catch {
    /* continue */
  }
  return null;
}

function asciiAttachmentFilename(name: string) {
  const base = (name || "attachment").replace(/"/g, "_").replace(/[\r\n]/g, "_").trim() || "attachment.pdf";
  return base.replace(/[^\x20-\x7E]/g, "_").replace(/[/\\]/g, "_").slice(0, 200);
}

/** Gmail often collapses parts with the same filename — prefix with order; prefer stored URL stem. */
function mimeAttachmentFilename(originalName: string, fileUrl: string, zeroBasedIndex: number): string {
  let stem = (originalName || "").trim() || "attachment.pdf";
  try {
    const seg = uploadPathnameOnly(fileUrl).split("/").filter(Boolean).pop() || "";
    if (seg) stem = safeDecodePathSegment(seg);
  } catch {
    /* keep stem */
  }
  const safe = asciiAttachmentFilename(stem);
  const n = zeroBasedIndex + 1;
  return `${String(n).padStart(2, "0")}-${safe}`;
}

function primaryMimeType(mime: string | null | undefined) {
  const m = (mime || "application/pdf").split(";")[0].trim().toLowerCase();
  return m || "application/pdf";
}

/** RFC 2045-style wrapping so MIME lines are not arbitrarily long (some transports are picky). */
function wrapBase64ForMime(b64: string) {
  const cleaned = b64.replace(/\s+/g, "");
  const lines: string[] = [];
  for (let i = 0; i < cleaned.length; i += 76) {
    lines.push(cleaned.slice(i, i + 76));
  }
  return lines.join("\r\n");
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

  // Always append native Gmail HTML signature when available; strip plain-text tail first so drafts
  // (including AI-generated bodies that already include the signature) are not duplicated.
  const signatureHtmlForSend = await fetchGmailSignatureHtml(accessToken);

  let plainBody = typeof body === "string" ? body : "";
  if (signatureHtmlForSend) {
    const sigPlain = gmailSignatureHtmlToPlainText(signatureHtmlForSend);
    plainBody = stripTrailingPlainSignature(plainBody, sigPlain);
  }

  // =========================
  // FETCH ATTACHMENTS SAFELY (sequential: avoids stampedes / flaky parallel self-fetches on serverless)
  // =========================
  type LoadedAtt = { filename: string; mimeType: string; content: Buffer };
  const files: LoadedAtt[] = [];
  for (const file of attachments) {
    if (!file.url) {
      console.warn("ATTACHMENT SKIP: missing url for", file.name);
      continue;
    }

    try {
      let buffer: Buffer | null = tryReadUploadFromDisk(file.url);

      if (!buffer) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const res = await fetch(resolveAttachmentFetchUrl(file.url), {
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          console.error("ATTACHMENT HTTP FAILED:", file.url, res.status, res.statusText);
          continue;
        }

        buffer = Buffer.from(await res.arrayBuffer());
      }

      if (buffer.byteLength > 10 * 1024 * 1024) {
        console.warn("ATTACHMENT TOO LARGE:", file.name);
        continue;
      }

      files.push({
        filename: mimeAttachmentFilename(file.name, file.url, files.length),
        mimeType: primaryMimeType(file.mimeType),
        content: buffer,
      });
    } catch (err) {
      console.error("ATTACHMENT FETCH FAILED:", file.url, err);
    }
  }

  const validFiles = files;

  const expectedWithUrl = attachments.filter((a) => !!a.url).length;
  if (expectedWithUrl > 0 && validFiles.length === 0) {
    throw new Error(
      "Attachments could not be loaded (missing files or unreachable URLs). Message not sent so nothing is delivered without PDFs."
    );
  }
  if (expectedWithUrl > 0 && validFiles.length < expectedWithUrl) {
    console.warn(
      "SEND: some attachments failed to load; sending with",
      validFiles.length,
      "of",
      expectedWithUrl
    );
  }

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

  const plainText = plainBody;

  const htmlBodyPromise = (async () => {
    const text = plainText.trim();
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const paragraphs = normalized.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const escaped = paragraphs.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`).join("\n\n");
    const withSig = signatureHtmlForSend ? `${escaped}<br/>${signatureHtmlForSend}` : escaped;
    return `<!DOCTYPE html><html><body>${withSig}</body></html>`;
  })();

  // multipart/alternative part
  parts.push(`--${boundary}`);
  parts.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
  parts.push("");

  // Plain + HTML as base64 so UTF-8 (signatures, emoji) never violates 7bit; Gmail parses attachments reliably.
  const plainB64 = wrapBase64ForMime(Buffer.from(plainText, "utf-8").toString("base64"));
  parts.push(`--${altBoundary}`);
  parts.push("Content-Type: text/plain; charset=UTF-8");
  parts.push("Content-Transfer-Encoding: base64");
  parts.push("");
  parts.push(plainB64);

  const htmlResolved = await htmlBodyPromise;
  const htmlB64 = wrapBase64ForMime(Buffer.from(htmlResolved, "utf-8").toString("base64"));
  parts.push(`--${altBoundary}`);
  parts.push("Content-Type: text/html; charset=UTF-8");
  parts.push("Content-Transfer-Encoding: base64");
  parts.push("");
  parts.push(htmlB64);

  // end alt
  parts.push(`--${altBoundary}--`);

  // attachments (if any)
  for (const file of validFiles) {
    const fn = file.filename.replace(/\\/g, "_").replace(/"/g, "_");
    parts.push(`--${boundary}`);
    parts.push(`Content-Type: ${file.mimeType}; name="${fn}"`);
    parts.push("Content-Transfer-Encoding: base64");
    parts.push(`Content-Disposition: attachment; filename="${fn}"`);
    parts.push("");
    parts.push(wrapBase64ForMime(file.content.toString("base64")));
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

  // Gmail expects web-safe base64 without URL-breaking line breaks; keep padding (=) — stripping can break decode.
  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

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