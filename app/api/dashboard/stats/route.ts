import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGmailClient } from "@/lib/gmail";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId: string | undefined = (session.user as { id?: string }).id;

    if (!userId) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });

      if (!dbUser?.id) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      userId = dbUser.id;
    }

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Count sent emails (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const emailsSent = await prisma.email.count({
      where: {
        userId,
        status: "SENT",
        sentAt: { gte: thirtyDaysAgo },
      },
    });

    // Count new unread inbox emails from Gmail
    let newEmails = 0;
    try {
      const accessToken = (session as any).accessToken;
      if (accessToken) {
        const gmail = getGmailClient(accessToken);
        const res = await gmail.users.messages.list({
          userId: "me",
          maxResults: 500,
          q: "is:unread in:inbox",
        });
        newEmails = res.data.messages?.length ?? 0;
      }
    } catch (e) {
      console.warn("DASHBOARD STATS: Could not fetch Gmail unread count", e);
    }

    // Follow-ups: count and find the closest one
    const followUpCount = await prisma.email.count({
      where: {
        userId,
        status: "FOLLOW_UP",
      },
    });

    const closestFollowUp = await prisma.email.findFirst({
      where: {
        userId,
        status: "FOLLOW_UP",
      },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        scheduledAt: true,
        to: true,
        subject: true,
      },
    });

    return NextResponse.json({
      emailsSent,
      newEmails,
      followUpCount,
      closestFollowUp: closestFollowUp
        ? {
            id: closestFollowUp.id,
            scheduledAt: closestFollowUp.scheduledAt?.toISOString() ?? null,
            to: closestFollowUp.to,
            subject: closestFollowUp.subject,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error("DASHBOARD STATS ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
