import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const invite = await prisma.invite.findUnique({
    where: { token },
  });

  if (!invite || invite.used) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    email: invite.email,
  });
}