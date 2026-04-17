import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { applicationId } = await req.json();

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!app) {
      return NextResponse.json({ success: false }, { status: 404 });
    }

    // generate secure token
    const token = crypto.randomBytes(32).toString("hex");

    // create invite
    await prisma.invite.create({
      data: {
        email: app.email,
        token,
        plan: app.desiredPlan,
      },
    });

    // update application status
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: "APPROVED" },
    });

    return NextResponse.json({
      success: true,
      inviteLink: `${process.env.NEXTAUTH_URL}/signup?token=${token}`,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}