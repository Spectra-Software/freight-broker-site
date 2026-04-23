import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId: string | undefined = (session.user as { id?: string }).id;
    if (!userId) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      userId = dbUser?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const leads = await prisma.lead.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ leads });
  } catch (err) {
    console.error("GET LEADS ERROR:", err);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId: string | undefined = (session.user as { id?: string }).id;
    if (!userId) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      userId = dbUser?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { company, contactName, phone, email, commodity, status, lastCalledAt, callbackAt } = body;

    if (!company?.trim()) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: {
        userId,
        company: company.trim(),
        contactName: contactName?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        commodity: commodity?.trim() || null,
        status: status || "COLD",
        lastCalledAt: lastCalledAt ? new Date(lastCalledAt) : null,
        callbackAt: callbackAt ? new Date(callbackAt) : null,
      },
    });

    return NextResponse.json({ lead });
  } catch (err) {
    console.error("CREATE LEAD ERROR:", err);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId: string | undefined = (session.user as { id?: string }).id;
    if (!userId) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      userId = dbUser?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { id, company, contactName, phone, email, commodity, status, lastCalledAt, callbackAt } = body;

    if (!id) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
    }

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...(company !== undefined ? { company: company.trim() } : {}),
        ...(contactName !== undefined ? { contactName: contactName?.trim() || null } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
        ...(commodity !== undefined ? { commodity: commodity?.trim() || null } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(lastCalledAt !== undefined ? { lastCalledAt: lastCalledAt ? new Date(lastCalledAt) : null } : {}),
        ...(callbackAt !== undefined ? { callbackAt: callbackAt ? new Date(callbackAt) : null } : {}),
      },
    });

    return NextResponse.json({ lead });
  } catch (err) {
    console.error("UPDATE LEAD ERROR:", err);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId: string | undefined = (session.user as { id?: string }).id;
    if (!userId) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });
      userId = dbUser?.id;
    }

    if (!userId) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
    }

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    await prisma.lead.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE LEAD ERROR:", err);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}
