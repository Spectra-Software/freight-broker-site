import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        company: true,
        phone: true,
        role: true,
        status: true,
        plan: true,
        isOnboarded: true,
        preferGmailSignature: true,
        createdAt: true,
        _count: {
          select: {
            emails: true,
            applications: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get user's emails (chat logs)
    const emails = await prisma.email.findMany({
      where: { userId: id },
      select: {
        id: true,
        type: true,
        status: true,
        to: true,
        from: true,
        subject: true,
        body: true,
        snippet: true,
        company: true,
        scheduledAt: true,
        sentAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Get user's applications
    const applications = await prisma.application.findMany({
      where: { userId: id },
      select: {
        id: true,
        name: true,
        company: true,
        email: true,
        comments: true,
        desiredPlan: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ user, emails, applications });
  } catch (error: unknown) {
    console.error("ADMIN USER DETAIL ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch user" },
      { status: 500 }
    );
  }
}
