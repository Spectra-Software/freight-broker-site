import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/google/gmail";

export async function GET(req: Request) {
  try {
    // ==============================
    // 🔐 CRON AUTH
    // ==============================
    const authHeader = req.headers.get("authorization");

    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // ==============================
    // 🔥 FETCH DUE FOLLOW-UPS
    // ==============================
    const followUps = await prisma.email.findMany({
      where: {
        status: "FOLLOW_UP",
        scheduledAt: {
          lte: now,
        },
        // 🔒 prevent double processing
        NOT: {
          status: "SENT",
        },
      },
      include: {
        user: true,
        attachments: true,
      },
      take: 20, // 🔥 batch limit (prevents Gmail throttling)
    });

    const results = [];

    // ==============================
    // 🔥 PROCESS EMAILS (SAFE LOOP)
    // ==============================
    for (const email of followUps) {
      try {
        // ==============================
        // 🔒 LOCK EMAIL (PREVENT DUPES)
        // ==============================
        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: "SENDING",
          },
        });

        const user = email.user;

        if (!user?.accessToken) {
          results.push({
            id: email.id,
            status: "missing_access_token",
          });
          continue;
        }

        // ==============================
        // 📎 FIX ATTACHMENT SHAPE
        // ==============================
        const attachments = email.attachments.map((a) => ({
          name: a.name,
          url: a.url ?? undefined,
          mimeType: a.mimeType ?? undefined,
        }));

        // ==============================
        // 📧 SEND EMAIL
        // ==============================
        await sendEmail({
          accessToken: user.accessToken,
          to: email.to,
          subject: email.subject,
          body: email.body,
          attachments,
        });

        // ==============================
        // ✅ MARK AS SENT
        // ==============================
        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });

        results.push({ id: email.id, status: "sent" });

        // ==============================
        // ⏱ RATE LIMIT SAFETY
        // ==============================
        await new Promise((r) => setTimeout(r, 500));
      } catch (err: any) {
        console.error("CRON ERROR:", err);

        // ==============================
        // ❌ MARK FAILURE BUT KEEP SYSTEM STABLE
        // ==============================
        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: "FAILED",
            lastError: err?.message ?? "unknown error",
          },
        });

        results.push({
          id: email.id,
          status: "failed",
        });
      }
    }

    // ==============================
    // RESPONSE
    // ==============================
    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (err: any) {
    console.error("CRON GLOBAL ERROR:", err);

    return NextResponse.json(
      {
        error: err.message || "Cron failed",
      },
      { status: 500 }
    );
  }
}