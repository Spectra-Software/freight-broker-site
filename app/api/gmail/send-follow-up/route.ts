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

    // Only allow sending follow-ups that have passed their scheduled date
    const now = new Date();
    const followUps = await prisma.email.findMany({
      where: {
        id: { in: ids },
        status: "FOLLOW_UP",
        scheduledAt: { lte: now },
      },
      include: { attachments: true },
    });

    if (!followUps.length) {
      return NextResponse.json({ error: "No follow-ups ready to send (must be past scheduled date)" }, { status: 400 });
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
          await prisma.user.update({
            where: { email: session.user.email },
            data: { accessToken, tokenExpiry: new Date(expiry), refreshToken: tok.refresh_token ?? dbUser.refreshToken ?? null },
          });
        }
      }
    } catch (e) {
      console.error("Token refresh failed:", e);
    }

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const followUp of followUps) {
      try {
        const attachments = (followUp.attachments || []).map((a: any) => ({
          name: a.name,
          url: a.url ?? undefined,
          mimeType: a.mimeType ?? null,
        }));

        await sendEmail({
          accessToken: accessToken!,
          to: followUp.to,
          subject: followUp.subject,
          body: followUp.body,
          attachments,
        });

        await prisma.email.update({
          where: { id: followUp.id },
          data: { status: "SENT", sentAt: new Date() },
        });

        results.push({ id: followUp.id, ok: true });
      } catch (err: any) {
        console.error("FOLLOW-UP SEND FAILED for", followUp.id, err);
        results.push({ id: followUp.id, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const sentCount = results.filter((r) => r.ok).length;

    return NextResponse.json({ success: true, sentCount, results });
  } catch (error: unknown) {
    console.error("FOLLOW-UP SEND ERROR:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send follow-ups" },
      { status: 500 }
    );
  }
}
