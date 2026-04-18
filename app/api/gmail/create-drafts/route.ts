// app/api/gmail/create-drafts/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type DraftAttachmentInput = {
  name: string;
  url?: string;
  mimeType?: string;
};

type LeadDraftInput = {
  company?: string;
  website?: string;
  email?: string;
  location?: string;
  draft?: {
    subject?: string;
    body?: string;
    attachments?: DraftAttachmentInput[];
  };
  attachments?: DraftAttachmentInput[];
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id as string | undefined;

    if (!userId) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });

      if (!dbUser) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      return await createDraftsForUser(req, dbUser.id);
    }

    return await createDraftsForUser(req, userId);
  } catch (error: any) {
    console.error("CREATE DRAFTS ERROR:", error);
    return NextResponse.json(
      {
        error:
          error?.message || "Failed to create drafts.",
      },
      { status: 500 }
    );
  }
}

async function createDraftsForUser(req: Request, userId: string) {
  const body = await req.json().catch(() => null);

  const leads: LeadDraftInput[] = Array.isArray(body?.leads)
    ? body.leads
    : [];

  if (!leads.length) {
    return NextResponse.json(
      { error: "No leads provided" },
      { status: 400 }
    );
  }

  const createdEmails: any[] = [];
  const skipped: Array<{ lead: LeadDraftInput; reason: string }> = [];

  const result = await prisma.$transaction(async (tx) => {
    for (const lead of leads) {
      const email = lead.email?.trim();
      const subject = lead.draft?.subject?.trim();
      const bodyText = lead.draft?.body?.trim();

      if (!email) {
        skipped.push({ lead, reason: "Missing email" });
        continue;
      }

      if (!subject) {
        skipped.push({ lead, reason: "Missing subject" });
        continue;
      }

      if (!bodyText) {
        skipped.push({ lead, reason: "Missing body" });
        continue;
      }

      const attachments =
        lead.draft?.attachments?.length
          ? lead.draft.attachments
          : lead.attachments || [];

      const created = await tx.email.create({
        data: {
          userId,
          type: "OUTBOUND",
          status: "DRAFT",
          to: email,
          from: null,
          subject,
          body: bodyText,
          snippet: bodyText.slice(0, 180),
          company: lead.company?.trim() || null,
          website: lead.website?.trim() || null,
          location: lead.location?.trim() || null,
          scheduledAt: null,
          sentAt: null,
          attachments: {
            create: attachments
              .filter((a) => a?.name)
              .map((a) => ({
                name: a.name,
                url: a.url ?? null,
                mimeType: a.mimeType ?? null,
              })),
          },
        },
        include: {
          attachments: true,
        },
      });

      createdEmails.push(created);
    }

    return createdEmails;
  });

  return NextResponse.json({
    ok: true,
    createdCount: result.length,
    skippedCount: skipped.length,
    drafts: result,
    skipped,
  });
}