import fs from "fs";
import path from "path";
import os from "os";
import { put } from "@vercel/blob";

export type PersistResult = { url: string; storedIn: "blob" | "public" | "tmp" };

/**
 * Persist an uploaded PDF. On Vercel, /tmp and local disk are not shared across
 * serverless invocations — email send runs elsewhere and would 404. Prefer Vercel Blob
 * (set BLOB_READ_WRITE_TOKEN from your Blob store).
 */
export async function persistUploadBuffer(
  buffer: Buffer,
  outName: string,
  mimeType: string
): Promise<PersistResult> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`email-attachments/${outName}`, buffer, {
      access: "public",
      contentType: mimeType || "application/pdf",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { url: blob.url, storedIn: "blob" };
  }

  const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
  const publicPath = path.join(uploadsDir, outName);

  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    fs.writeFileSync(publicPath, buffer);
    return { url: `/uploads/${outName}`, storedIn: "public" };
  } catch (err) {
    if (process.env.VERCEL) {
      throw new Error(
        "Could not write to public/uploads on this deployment (filesystem is read-only). " +
          "Create a Vercel Blob store and add BLOB_READ_WRITE_TOKEN to this project so uploads survive across server instances."
      );
    }

    console.warn("UPLOAD: public/uploads failed, using tmp (OK for local dev only):", err);
    const tmpPath = path.join(os.tmpdir(), outName);
    fs.writeFileSync(tmpPath, buffer);
    return { url: `/api/uploads/files/${outName}`, storedIn: "tmp" };
  }
}
