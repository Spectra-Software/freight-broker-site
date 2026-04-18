import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { token, name, company, phone } = body;

    if (!token || !name || !company) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. find invite by token
    const invite = await prisma.invite.findUnique({
      where: { token },
    });

    if (!invite || invite.used) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired invite" },
        { status: 400 }
      );
    }

    // 2. update user with onboarding info
    await prisma.user.update({
      where: { email: invite.email },
      data: {
        name,
        company,
        phone,
        isOnboarded: true,
      },
    });

    // 3. mark invite as used
    await prisma.invite.update({
      where: { token },
      data: { used: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CREATE ACCOUNT ERROR:", error);

    return NextResponse.json(
      { success: false, error: "Failed to create account" },
      { status: 500 }
    );
  }
}