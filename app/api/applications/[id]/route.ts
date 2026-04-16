import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { status } = await req.json();

  const app = await prisma.application.update({
    where: { id: params.id },
    data: { status },
  });

  // 🔥 If approved → link to user + grant access
  if (status === "APPROVED") {
    await prisma.user.updateMany({
      where: { email: app.email },
      data: {},
    });
  }

  return NextResponse.json(app);
}