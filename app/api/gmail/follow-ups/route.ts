import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/google/gmail";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  try {
    // ==========================
    // 🔐 AUTH CHECK (OPTIONAL)
    // ==========================
    const authHeader = req.headers.get("authorization");

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();

    // ==========================
    // 🔥 FETCH DUE FOLLOW-UPS
    // ==========================
    const followUps = await prisma.email.findMany({
      where: {
        status: "FOLLOW_UP",
        scheduledAt: {
          lte: now,
        },
      },
      include: {
        user: true,
        attachments: true,
      },
      take: 20,
    });

    const results: any[] = [];

    // ==========================
    // 🔥 PROCESS EMAILS
    // ==========================
    for (const email of followUps) {
      try {
        const user = email.user as any;

        const accessToken = user?.accessToken;

        if (!accessToken) {
          results.push({
            id: email.id,
            status: "skipped_no_token",
          });
          continue;
        }

        // ==========================
        // 📎 SAFE ATTACHMENTS
        // ==========================
        const attachments = (email.attachments ?? []).map(
          (a: any) => ({
            name: a.name,
            url: a.url ?? undefined,
            mimeType: a.mimeType ?? undefined,
          })
        );

        // ==========================
        // 📧 SEND EMAIL
        // ==========================
        await sendEmail({
          accessToken,
          to: email.to,
          subject: email.subject,
          body: email.body,
          attachments,
        });

        // ==========================
        // ✅ MARK AS SENT
        // ==========================
        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });

        results.push({
          id: email.id,
          status: "sent",
        });
      } catch (err: any) {
        console.error("FOLLOW-UP SEND ERROR:", err);

        results.push({
          id: email.id,
          status: "failed",
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error("FOLLOW-UP ROUTE ERROR:", error);

    return NextResponse.json(
      {
        error: error?.message || "Follow-up processing failed",
      },
      { status: 500 }
    );
  }
}