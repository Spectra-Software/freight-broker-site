import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

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
    // Support two modes:
    // 1) Binary upload: client sends raw file body and sets headers 'x-file-name' and 'x-file-mime'
    // 2) JSON upload: legacy base64 payload { name, mimeType, data }

    const headerName = decodeFilename(req.headers.get("x-file-name"));
    const headerMime = req.headers.get("x-file-mime") || "application/pdf";

    const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
    let safeName = "upload.pdf";
    let filename = "";
    let mimeType = headerMime;
    let displayName = "upload.pdf";

    // Helper to persist buffer to filesystem, try public/uploads then fall back to tmpdir
    const persistBuffer = (buf: Buffer, outName: string) => {
      const publicPath = path.join(uploadsDir, outName);

      try {
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        fs.writeFileSync(publicPath, buf);
        // Serve via static public path
        return { url: `/uploads/${outName}`, storedIn: "public" };
      } catch {
        const tmpPath = path.join(os.tmpdir(), outName);
        fs.writeFileSync(tmpPath, buf);
        // Serve via API route that reads tmpdir
        return { url: `/api/uploads/files/${outName}`, storedIn: "tmp" };
      }
    };

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

      const result = persistBuffer(buffer, filename);
      return NextResponse.json({ ok: true, url: result.url, name: displayName, mimeType });
    }

    // Fallback: JSON/base64 mode
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
    const result = persistBuffer(buffer, filename);

    return NextResponse.json({ ok: true, url: result.url, name: displayName, mimeType });
  } catch (err: unknown) {
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Upload failed" }, { status: 500 });
  }
}
