import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const preferGmailSignature = !!body.preferGmailSignature;

    await prisma.user.update({ where: { email: session.user.email }, data: { preferGmailSignature } });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('PREFERENCE SAVE ERROR:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
