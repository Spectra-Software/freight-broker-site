import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    // Resolve userId from session (consistent with other routes)
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

    // Find any emails matching these IDs that belong to the current user.
    // Do not require a specific status so users can delete drafts/approvals as needed.
    const drafts = await prisma.email.findMany({
      where: { id: { in: ids }, userId },
      include: { attachments: true },
    });

    if (!drafts.length) {
      return NextResponse.json({ error: "No matching emails found for deletion" }, { status: 404 });
    }

    // delete attachments rows first
    const attachmentIds: string[] = drafts.flatMap((d: { attachments?: { id: string }[] }) =>
      (d.attachments || []).map((a) => a.id)
    );

    if (attachmentIds.length) {
      await prisma.attachment.deleteMany({ where: { id: { in: attachmentIds } } });
    }

    await prisma.email.deleteMany({ where: { id: { in: ids } } });

    return NextResponse.json({ success: true, deletedCount: drafts.length });
  } catch (error: unknown) {
    console.error("DELETE DRAFTS ERROR:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete drafts",
      },
      { status: 500 }
    );
  }
}
