import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await req.json();

    const updated = await prisma.application.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Failed to update application" },
      { status: 500 }
    );
  }
}