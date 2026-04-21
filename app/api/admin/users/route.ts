import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      where: {
        isOnboarded: true,
      },
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
        createdAt: true,
        _count: {
          select: {
            emails: true,
            applications: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users });
  } catch (error: unknown) {
    console.error("ADMIN USERS GET ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { userId, status } = body as {
      userId?: string;
      status?: "ACTIVE" | "SUSPENDED" | "BANNED";
    };

    if (!userId || !status) {
      return NextResponse.json(
        { error: "userId and status are required" },
        { status: 400 }
      );
    }

    // Prevent admins from banning themselves
    if (userId === (session.user as any)?.id && status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Cannot modify your own status" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("ADMIN USERS PATCH ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update user" },
      { status: 500 }
    );
  }
}
