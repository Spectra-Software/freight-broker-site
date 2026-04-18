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

    // 2. CREATE OR UPDATE USER (FIXED ✅)
    const user = await prisma.user.upsert({
      where: { email: invite.email },
      update: {
        name,
        company,
        phone,
        isOnboarded: true,
        plan: invite.plan,
      },
      create: {
        email: invite.email,
        name,
        company,
        phone,
        isOnboarded: true,
        plan: invite.plan,
        role: "USER",
      },
    });

    // 3. link application → user (BONUS FIX ✅)
    await prisma.application.updateMany({
      where: { email: invite.email },
      data: {
        userId: user.id,
      },
    });

    // 4. mark invite as used
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