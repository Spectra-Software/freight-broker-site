import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { firstName, lastName, company, email, phone } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email required" },
        { status: 400 }
      );
    }

    const application = await prisma.application.create({
      data: {
        firstName,
        lastName,
        company,
        email,
        phone,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      success: true,
      application,
    });
  } catch (err) {
    console.error("Application POST error:", err);

    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const applications = await prisma.application.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(applications);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch" },
      { status: 500 }
    );
  }
}