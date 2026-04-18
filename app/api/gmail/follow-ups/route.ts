import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/google/gmail";

const CRON_SECRET = process.env.CRON_SECRET;

type DbAttachment = {
  name: string;
  url: string | null;
  mimeType: string | null;
};

type SafeAttachment = {
  name: string;
  url?: string;
  mimeType?: string;
};

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const followUps = await prisma.email.findMany({
      where: {
        status: "FOLLOW_UP",
        scheduledAt: { lte: new Date() },
      },
      include: {
        user: true,
        attachments: true,
      },
      take: 20,
    });

    const results: Array<{ id: string; status: string }> = [];

    for (const email of followUps) {
      try {
        const accessToken = (email.user as any)?.accessToken as
          | string
          | undefined;

        if (!accessToken) {
          results.push({
            id: email.id,
            status: "skipped_no_token",
          });
          continue;
        }

        const attachments: SafeAttachment[] = (email.attachments ?? []).map(
          (a: DbAttachment) => ({
            name: a.name,
            url: a.url ?? undefined,
            mimeType: a.mimeType ?? undefined,
          })
        );

        await sendEmail({
          accessToken,
          to: email.to,
          subject: email.subject,
          body: email.body,
          attachments,
        });

        await prisma.email.update({
          where: { id: email.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });

        results.push({ id: email.id, status: "sent" });
      } catch (err) {
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
    return NextResponse.json(
      { error: error?.message || "Follow-up processing failed" },
      { status: 500 }
    );
  }
}