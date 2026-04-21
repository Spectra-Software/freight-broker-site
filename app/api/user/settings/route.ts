import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        company: true,
        phone: true,
        role: true,
        plan: true,
        preferGmailSignature: true,
        isOnboarded: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: unknown) {
    console.error("USER SETTINGS GET ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, company, phone, preferGmailSignature } = body as {
      name?: string;
      company?: string;
      phone?: string;
      preferGmailSignature?: boolean;
    };

    const updated = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(company !== undefined ? { company } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(preferGmailSignature !== undefined ? { preferGmailSignature } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        company: true,
        phone: true,
        role: true,
        plan: true,
        preferGmailSignature: true,
        isOnboarded: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    console.error("USER SETTINGS PATCH ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}
