import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type FollowUpAttachmentRow = {
  id: string;
  name: string;
  url: string | null;
  mimeType: string | null;
};

type FollowUpRow = {
  id: string;
  to: string;
  from: string | null;
  subject: string;
  body: string;
  snippet: string | null;
  company: string | null;
  website: string | null;
  location: string | null;
  scheduledAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  parentId: string | null;
  attachments: FollowUpAttachmentRow[];
};

type FollowUpEmail = {
  id: string;
  to: string;
  from: string | null;
  subject: string;
  body: string;
  snippet: string | null;
  company: string | null;
  website: string | null;
  location: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  time: string;
  status: "FOLLOW_UP";
  parentId: string | null;
  attachments: {
    id: string;
    name: string;
    url: string | null;
    mimeType: string | null;
  }[];
};

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

    const followUps: FollowUpRow[] = await prisma.email.findMany({
      where: {
        userId,
        status: "FOLLOW_UP",
      },
      include: {
        attachments: true,
      },
      orderBy: {
        scheduledAt: "asc",
      },
    });

    const formatted: FollowUpEmail[] = followUps.map((email: FollowUpRow) => ({
      id: email.id,
      to: email.to,
      from: email.company || email.to,
      subject: email.subject,
      body: email.body,
      snippet: email.snippet,
      company: email.company,
      website: email.website,
      location: email.location,
      scheduledAt: email.scheduledAt ? email.scheduledAt.toISOString() : null,
      sentAt: email.sentAt ? email.sentAt.toISOString() : null,
      time: email.createdAt.toISOString(),
      status: "FOLLOW_UP",
      parentId: email.parentId,
      attachments: (email.attachments ?? []).map((a: FollowUpAttachmentRow) => ({
        id: a.id,
        name: a.name,
        url: a.url,
        mimeType: a.mimeType,
      })),
    }));

    return NextResponse.json({
      messages: formatted,
    });
  } catch (error: unknown) {
    console.error("FOLLOW-UPS LIST ERROR:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch follow-ups" },
      { status: 500 }
    );
  }
}