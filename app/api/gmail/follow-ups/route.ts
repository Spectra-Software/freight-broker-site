import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/google/gmail";

const CRON_SECRET = process.env.CRON_SECRET;

type AttachmentInput = {
  name: string;
  url?: string | null;
  mimeType?: string | null;
};

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const now = new Date();

    const followUps = await prisma.email.findMany({
      where: {
        status: "FOLLOW_UP",
        scheduledAt: { lte: now },
      },
      include: {
        user: true,
        attachments: true,
      },
      take: 20,
    });

    const results: any[] = [];

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

        const attachments: AttachmentInput[] = (email.attachments ?? []).map(
          (a: AttachmentInput) => ({
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

        results.push({ id: email.id, status: "failed" });
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