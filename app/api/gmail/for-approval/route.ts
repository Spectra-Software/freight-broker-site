import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let userId = (session.user as any).id as string | undefined;

    if (!userId) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      });

      if (!dbUser) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      userId = dbUser.id;
    }

    const drafts = await prisma.email.findMany({
      where: {
        userId,
        status: "DRAFT",
      },
      include: {
        attachments: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formatted = drafts.map((email) => ({
      id: email.id,
      to: email.to,
      from: email.from,
      subject: email.subject,
      body: email.body,
      snippet: email.snippet,
      company: email.company,
      website: email.website,
      location: email.location,
      createdAt: email.createdAt,

      // ✅ FIXED HERE TOO
      attachments: email.attachments.map(
        (a: {
          id: string;
          name: string;
          url: string | null;
          mimeType: string | null;
        }) => ({
          id: a.id,
          name: a.name,
          url: a.url,
          mimeType: a.mimeType,
        })
      ),
    }));

    return NextResponse.json({
      messages: formatted,
    });
  } catch (error: any) {
    console.error("FOR APPROVAL ERROR:", error);

    return NextResponse.json(
      {
        error: error?.message || "Failed to fetch drafts",
      },
      { status: 500 }
    );
  }
}