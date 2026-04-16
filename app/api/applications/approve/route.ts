import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing id" },
        { status: 400 }
      );
    }

    // 1. Get the application first
    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    // 2. Approve application
    const updated = await prisma.application.update({
      where: { id },
      data: {
        status: "APPROVED",
      },
    });

    // 3. Create user (or ensure it exists)
    await prisma.user.upsert({
      where: { email: application.email },
      update: {
        name: `${application.firstName} ${application.lastName}`,
      },
      create: {
        email: application.email,
        name: `${application.firstName} ${application.lastName}`,
      },
    });

    return NextResponse.json({
      success: true,
      application: updated,
    });
  } catch (err) {
    console.error("Approve error:", err);

    return NextResponse.json(
      { success: false, error: "Failed to approve" },
      { status: 500 }
    );
  }
}