import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    if (!prisma || !prisma.email) {
      return NextResponse.json({ error: "DB not available" }, { status: 500 });
    }

    // Fetch all sent emails for this user, returning company + email for dedup
    const sentEmails = await prisma.email.findMany({
      where: {
        userId,
        status: "SENT",
      },
      select: {
        company: true,
        to: true,
        website: true,
      },
      orderBy: { sentAt: "desc" },
    });

    // Deduplicate by company name (lowercase) so we just get unique companies
    const seen = new Set<string>();
    const unique: Array<{ company: string; email: string; website: string | null }> = [];

    for (const e of sentEmails) {
      const key = (e.company || e.to || "").toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push({
        company: e.company || e.to,
        email: e.to,
        website: e.website,
      });
    }

    return NextResponse.json({ sentCompanies: unique });
  } catch (err) {
    console.error("SENT COMPANIES ERROR:", err);
    return NextResponse.json({ error: "Failed to fetch sent companies" }, { status: 500 });
  }
}
