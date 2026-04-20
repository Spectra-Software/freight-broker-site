import { NextResponse } from "next/server";
import { persistUploadBuffer } from "@/lib/uploads/persistUpload";

export const runtime = "nodejs";

type UploadRequest = {
  name: string;
  mimeType: string;
  data: string; // base64
};

function decodeFilename(header: string | null): string | null {
  if (!header?.trim()) return null;
  try {
    return decodeURIComponent(header.replace(/\+/g, " "));
  } catch {
    return header.trim();
  }
}

function isPdfMime(mime: string) {
  const m = (mime || "").toLowerCase();
  return m.includes("pdf") || m === "application/octet-stream" || m === "";
}

export async function POST(req: Request) {
  try {
    const headerName = decodeFilename(req.headers.get("x-file-name"));
    const headerMime = req.headers.get("x-file-mime") || "application/pdf";

    let safeName = "upload.pdf";
    let filename = "";
    let mimeType = headerMime;
    let displayName = "upload.pdf";

    if (headerName) {
      if (!isPdfMime(headerMime)) {
        return NextResponse.json({ error: "Only PDF uploads are allowed" }, { status: 400 });
      }

      displayName = headerName.trim();
      safeName = displayName.replace(/[^a-zA-Z0-9._\-\s]/g, "_").replace(/\s+/g, "_").slice(0, 180) || "upload.pdf";
      filename = `${Date.now()}_${safeName}`;

      const arrayBuffer = await req.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.byteLength === 0) {
        return NextResponse.json({ error: "Empty file" }, { status: 400 });
      }

      const result = await persistUploadBuffer(buffer, filename, mimeType);
      return NextResponse.json({ ok: true, url: result.url, name: displayName, mimeType, storedIn: result.storedIn });
    }

    const body: unknown = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { name, mimeType: bodyMime, data } = body as UploadRequest;

    if (!name || !bodyMime || !data) {
      return NextResponse.json({ error: "Missing upload fields" }, { status: 400 });
    }

    mimeType = bodyMime;

    if (!isPdfMime(bodyMime)) {
      return NextResponse.json({ error: "Only PDF uploads are allowed" }, { status: 400 });
    }

    displayName = String(name).trim();
    safeName = displayName.replace(/[^a-zA-Z0-9._\-\s]/g, "_").replace(/\s+/g, "_").slice(0, 180) || "upload.pdf";
    filename = `${Date.now()}_${safeName}`;
    const buffer = Buffer.from(data, "base64");
    if (buffer.byteLength === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 });
    }
    const result = await persistUploadBuffer(buffer, filename, mimeType);

    return NextResponse.json({ ok: true, url: result.url, name: displayName, mimeType, storedIn: result.storedIn });
  } catch (err: unknown) {
    console.error("UPLOAD ERROR:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    const isConfig = message.includes("BLOB_READ_WRITE_TOKEN") || message.includes("read-only");
    return NextResponse.json({ error: message }, { status: isConfig ? 503 : 500 });
  }
}
