import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type DraftAttachmentInput = {
  name: string;
  url?: string | null;
  mimeType?: string | null;
  type?: string | null;
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

type CreatedAttachment = {
  id: string;
  name: string;
  url: string | null;
  mimeType: string | null;
};

type CreatedDraft = {
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
  attachments: CreatedAttachment[];
};

type ExistingDraftRow = {
  to: string;
  subject: string;
  company: string | null;
};

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(req: Request) {
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

    return await createDraftsForUser(req, userId);
  } catch (error: unknown) {
    console.error("CREATE DRAFTS ERROR:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create drafts.",
      },
      { status: 500 }
    );
  }
}

async function createDraftsForUser(req: Request, userId: string) {
  const body: unknown = await req.json().catch(() => null);

  const leads: LeadDraftInput[] =
    body &&
    typeof body === "object" &&
    "leads" in body &&
    Array.isArray((body as { leads: unknown }).leads)
      ? ((body as { leads: LeadDraftInput[] }).leads as LeadDraftInput[])
      : [];

  if (!leads.length) {
    return NextResponse.json({ error: "No leads provided" }, { status: 400 });
  }

  const existingDrafts: ExistingDraftRow[] = await prisma.email.findMany({
    where: {
      userId,
      status: "DRAFT",
    },
    select: {
      to: true,
      subject: true,
      company: true,
    },
  });

  const seen = new Set<string>(
    existingDrafts.map((draft: ExistingDraftRow) =>
      [normalize(draft.to), normalize(draft.subject), normalize(draft.company)].join("|")
    )
  );

  const skipped: Array<{ lead: LeadDraftInput; reason: string }> = [];
  const createdEmails: CreatedDraft[] = [];

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

    const key = [normalize(email), normalize(subject), normalize(lead.company)].join("|");

    if (seen.has(key)) {
      skipped.push({ lead, reason: "Duplicate draft already exists" });
      continue;
    }

    seen.add(key);

    const attachmentInputs =
      lead.draft?.attachments?.length ? lead.draft.attachments : lead.attachments || [];

    const created = await prisma.email.create({
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
        ...(attachmentInputs.length > 0
          ? {
              attachments: {
                create: attachmentInputs.map((a: DraftAttachmentInput) => ({
                  name: a.name,
                  url: a.url ?? null,
                  mimeType: a.mimeType ?? a.type ?? null,
                })),
              },
            }
          : {}),
      },
      include: {
        attachments: true,
      },
    });

    createdEmails.push(created as CreatedDraft);
  }

  return NextResponse.json({
    ok: true,
    createdCount: createdEmails.length,
    skippedCount: skipped.length,
    drafts: createdEmails,
    skipped,
  });
}