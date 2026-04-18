import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/google/gmail";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    const followUps = await prisma.email.findMany({
      where: {
        status: "FOLLOW_UP",
        scheduledAt: {
          lte: now,
        },
        NOT: {
          status: "SENT",
        },
      },
      include: {
        user: true,
        attachments: true,
      },
      take: 20,
    });

    const results = [];

    for (const email of followUps) {
      try {
        await prisma.email.update({
          where: { id: email.id },
          data: { status: "SENDING" },
        });

        const user = email.user;

        if (!user?.accessToken) {
          results.push({
            id: email.id,
            status: "missing_access_token",
          });
          continue;
        }

        // ✅ FIXED TYPE HERE
        const attachments = email.attachments.map(
          (a: {
            name: string;
            url: string | null;
            mimeType: string | null;
          }) => ({
            name: a.name,
            url: a.url ?? undefined,
            mimeType: a.mimeType ?? undefined,
          })
        );

        await sendEmail({
          accessToken: user.accessToken,
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

        await new Promise((r) => setTimeout(r, 500));
      } catch (err: any) {
        console.error("CRON ERROR:", err);

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

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Cron failed" },
      { status: 500 }
    );
  }
}