import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/google/gmail";

// 🔐 optional: protect route
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
  try {
    // 🔐 verify cron (recommended)
    const authHeader = req.headers.get("authorization");

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 🔥 find due follow-ups
    const now = new Date();

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
    });

    const results = [];

    for (const email of followUps) {
      try {
        // ⚠️ IMPORTANT:
        // we need user's accessToken → currently not stored
        // so for now we SKIP unless you store tokens
        if (!(email.user as any)?.accessToken) {
          results.push({
            id: email.id,
            status: "skipped_no_token",
          });
          continue;
        }

        await sendEmail({
          accessToken: (email.user as any).accessToken,
          to: email.to,
          subject: email.subject,
          body: email.body,
          attachments: email.attachments,
        });

        // mark as sent
        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });

        results.push({ id: email.id, status: "sent" });
      } catch (err) {
        console.error("CRON SEND ERROR:", err);
        results.push({ id: email.id, status: "failed" });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error("CRON ERROR:", error);

    return NextResponse.json(
      {
        error:
          error?.message || "Cron failed",
      },
      { status: 500 }
    );
  }
}