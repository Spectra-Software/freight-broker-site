import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { applicationId } = await req.json();

    if (!applicationId) {
      return NextResponse.json(
        { success: false, error: "Missing applicationId" },
        { status: 400 }
      );
    }

    await prisma.application.update({
      where: { id: applicationId },
      data: { status: "DENIED" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DENY ERROR:", err);

    return NextResponse.json(
      { success: false, error: "Failed to deny application" },
      { status: 500 }
    );
  }
}