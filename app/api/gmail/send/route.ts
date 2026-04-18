import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/google/gmail";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json(
        { success: false, error: "No access token" },
        { status: 401 }
      );
    }

    const body = await req.json();

    // ==============================
    // MODE 1: BULK DRAFT SEND
    // ==============================
    if (body.ids && Array.isArray(body.ids)) {
      return await handleDraftSend(session, body.ids);
    }

    // ==============================
    // MODE 2: MANUAL SEND
    // ==============================
    const { to, subject, message } = body;

    if (!to || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    const result = await sendEmail({
      accessToken: session.accessToken as string,
      to,
      subject,
      body: message,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error("SEND ROUTE ERROR:", err);

    return NextResponse.json(
      { success: false, error: "Failed to send email" },
      { status: 500 }
    );
  }
}

// ==============================
// 🔥 DRAFT SEND HANDLER (FIXED)
// ==============================
async function handleDraftSend(session: any, ids: string[]) {
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: "Missing user session" },
      { status: 401 }
    );
  }

  const drafts = await prisma.email.findMany({
    where: {
      id: { in: ids },
      userId,
      status: "DRAFT",
    },
    include: {
      attachments: true,
    },
  });

  if (!drafts.length) {
    return NextResponse.json(
      { error: "No valid drafts found" },
      { status: 404 }
    );
  }

  const results = [];

  for (const draft of drafts) {
    try {
      // lock
      await prisma.email.update({
        where: { id: draft.id },
        data: { status: "SENDING" },
      });

      // ==============================
      // FIXED: typed attachments mapping
      // ==============================
      const attachments = draft.attachments.map(
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

      // send email
      await sendEmail({
        accessToken: session.accessToken as string,
        to: draft.to,
        subject: draft.subject,
        body: draft.body,
        attachments,
      });

      // mark sent
      await prisma.email.update({
        where: { id: draft.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
        },
      });

      // follow-up
      await prisma.email.create({
        data: {
          userId,
          type: "OUTBOUND",
          status: "FOLLOW_UP",
          to: draft.to,
          subject: `Follow up: ${draft.subject}`,
          body: generateFollowUp(draft.body),
          snippet: draft.body.slice(0, 120),
          scheduledAt: new Date(
            Date.now() + 14 * 24 * 60 * 60 * 1000
          ),
          parentId: draft.id,
          attachments: {
            create: draft.attachments.map((a) => ({
              name: a.name,
              url: a.url,
              mimeType: a.mimeType,
            })),
          },
        },
      });

      results.push({ id: draft.id, status: "sent" });

      // small delay (rate limiting safety)
      await new Promise((r) => setTimeout(r, 300));
    } catch (err: any) {
      console.error("SEND ERROR:", err);

      await prisma.email.update({
        where: { id: draft.id },
        data: {
          status: "FAILED",
        },
      });

      results.push({ id: draft.id, status: "failed" });
    }
  }

  return NextResponse.json({
    success: true,
    results,
  });
}

// ==============================
// FOLLOW-UP TEMPLATE
// ==============================
function generateFollowUp(original: string) {
  return `
<p>Just checking in on my previous email.</p>

<p>${original.slice(0, 200)}...</p>

<p>Let me know if you're interested in working together.</p>
`;
}