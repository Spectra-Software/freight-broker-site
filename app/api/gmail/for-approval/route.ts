import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type DraftAttachment = {
  id: string;
  name: string;
  url: string | null;
  mimeType: string | null;
};

type DraftRow = {
  id: string;
  to: string;
  from: string | null;
  subject: string;
  body: string;
  snippet: string | null;
  company: string | null;
  website: string | null;
  location: string | null;
  createdAt: Date;
  attachments: DraftAttachment[];
};

type DraftEmail = {
  id: string;
  to: string;
  from: string | null;
  subject: string;
  body: string;
  snippet: string | null;
  company: string | null;
  website: string | null;
  location: string | null;
  createdAt: Date;
  attachments: DraftAttachment[];
};

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId: string | undefined = (session.user as any).id;

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

    const drafts = (await prisma.email.findMany({
      where: {
        userId,
        status: "DRAFT",
      },
      include: {
        attachments: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    })) as DraftRow[];

    const formatted: DraftEmail[] = drafts.map((email: DraftRow) => ({
      id: email.id,
      to: email.to,
      from: email.from,
      subject: email.subject,
      body: email.body,
      snippet: email.snippet,
      company: email.company,
      website: email.website,
      location: email.location,
      createdAt: email.createdAt,
      attachments: (email.attachments ?? []).map((a: DraftAttachment) => ({
        id: a.id,
        name: a.name,
        url: a.url,
        mimeType: a.mimeType,
      })),
    }));

    return NextResponse.json({
      messages: formatted,
    });
  } catch (error: any) {
    console.error("FOR APPROVAL ERROR:", error);

    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch drafts",
      },
      { status: 500 }
    );
  }
}