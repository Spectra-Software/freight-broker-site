import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/google/gmail";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await req.json().catch(() => ({}));

    const ids: string[] =
      body &&
      typeof body === "object" &&
      "ids" in body &&
      Array.isArray((body as { ids?: unknown }).ids)
        ? ((body as { ids: string[] }).ids)
        : [];

    if (!ids.length) {
      return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
    }

    const drafts = await prisma.email.findMany({
      where: {
        id: { in: ids },
        status: "DRAFT",
      },
      include: { attachments: true },
    });

    if (!drafts.length) {
      return NextResponse.json({ error: "No drafts found" }, { status: 404 });
    }

    // Load tokens for the user from DB
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { accessToken: true, refreshToken: true, tokenExpiry: true },
    });

    if (!dbUser?.accessToken && !dbUser?.refreshToken) {
      return NextResponse.json({ error: "No OAuth tokens available for user" }, { status: 400 });
    }

    // If access token expired try to refresh
    let accessToken = dbUser?.accessToken ?? null;
    try {
      if (dbUser?.tokenExpiry && dbUser.tokenExpiry.getTime() < Date.now() - 60000) {
        // refresh token
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: dbUser.refreshToken ?? "",
          }),
        });

        if (res.ok) {
          const tok = await res.json();
          accessToken = tok.access_token;
          const expiry = tok.expires_in ? Date.now() + tok.expires_in * 1000 : Date.now() + 3600 * 1000;
          // persist
          await prisma.user.update({ where: { email: session.user.email }, data: { accessToken, tokenExpiry: new Date(expiry), refreshToken: tok.refresh_token ?? dbUser.refreshToken ?? null } });
        }
      }
    } catch (e) {
      console.error("Token refresh failed:", e);
    }

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const draft of drafts) {
      try {
        console.log("Sending email to:", draft.to);

        // prepare attachments
        const attachments = (draft.attachments || []).map((a: any) => ({ name: a.name, url: a.url ?? undefined, mimeType: a.mimeType ?? null }));

        await sendEmail({
          accessToken: accessToken!,
          to: draft.to,
          subject: draft.subject,
          body: draft.body,
          attachments,
        });

        await prisma.email.update({ where: { id: draft.id }, data: { status: "SENT", sentAt: new Date() } });

        // Update matching Lead status to DRAFT_SENT
        if (draft.company) {
          try {
            const lead = await prisma.lead.findFirst({
              where: { userId: draft.userId, company: draft.company, status: "DRAFT_CREATED" },
            });
            if (lead) {
              await prisma.lead.update({ where: { id: lead.id }, data: { status: "DRAFT_SENT" } });
            }
          } catch (leadErr) {
            console.error("Failed to update lead status to DRAFT_SENT:", leadErr);
          }
        }

        // Auto-create a follow-up email scheduled 14 days from now
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + 14);

        const followUpSubject = draft.subject.startsWith("Re:")
          ? draft.subject
          : `Re: ${draft.subject}`;

        const followUpBody = `Hi team,\n\nI wanted to follow up on my previous email below. We'd love the opportunity to work with you and support your logistics needs.\n\nPlease let me know if you have any questions or if there's a better contact I should reach out to.\n\nBest regards`;

        await prisma.email.create({
          data: {
            userId: draft.userId,
            type: "OUTBOUND",
            status: "FOLLOW_UP",
            to: draft.to,
            from: draft.from,
            subject: followUpSubject,
            body: followUpBody,
            snippet: followUpBody.slice(0, 180),
            company: draft.company,
            website: draft.website,
            location: draft.location,
            scheduledAt: followUpDate,
            parentId: draft.id,
          },
        });

        results.push({ id: draft.id, ok: true });
      } catch (err: any) {
        console.error("SEND EMAIL FAILED for", draft.id, err);
        results.push({ id: draft.id, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const sentCount = results.filter((r) => r.ok).length;

    return NextResponse.json({ success: true, sentCount, results });
  } catch (error: unknown) {
    console.error("SEND ERROR:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send emails",
      },
      { status: 500 }
    );
  }
}