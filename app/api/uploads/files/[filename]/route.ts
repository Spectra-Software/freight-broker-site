import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

export async function GET(_req: Request, context: any) {
  try {
    // context.params may be a Promise (some Next versions) or an object
    let filename: string | undefined;
    const params = context?.params;
    if (params) {
      if (typeof params.then === "function") {
        const resolved = await params;
        filename = resolved?.filename;
      } else {
        filename = params?.filename;
      }
    }

    if (!filename) return NextResponse.json({ error: "Missing filename" }, { status: 400 });

    // First, try public/uploads (for local/dev)
    const publicPath = path.resolve(process.cwd(), "public", "uploads", filename);
    if (fs.existsSync(publicPath)) {
      const buffer = fs.readFileSync(publicPath);
      const ext = path.extname(filename).toLowerCase();
      const mime = ext === ".pdf" ? "application/pdf" : "application/octet-stream";
      return new Response(buffer, {
        headers: { "Content-Type": mime },
      });
    }

    // Fallback: os.tmpdir()
    const tmpPath = path.join(os.tmpdir(), filename);
    if (fs.existsSync(tmpPath)) {
      const buffer = fs.readFileSync(tmpPath);
      const ext = path.extname(filename).toLowerCase();
      const mime = ext === ".pdf" ? "application/pdf" : "application/octet-stream";
      return new Response(buffer, {
        headers: { "Content-Type": mime },
      });
    }

    return NextResponse.json({ error: "File not found" }, { status: 404 });
  } catch (err: any) {
    console.error("UPLOAD FILE SERVE ERROR:", err);
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}
