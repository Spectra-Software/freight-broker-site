import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PlanTier } from "@prisma/client";

function normalizePlan(plan: string): PlanTier {
  const value = plan.trim().toLowerCase();

  if (value === "basic" || value.includes("starter")) return "BASIC";
  if (value === "mid" || value.includes("pro")) return "MID";
  return "PREMIUM";
}

export async function POST(req: Request) {
  try {
    console.log("SAVING APPLICATION...");

    const body = await req.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const company = String(body.company || "").trim();
    const comments = String(body.comments || "").trim();
    const plan = String(body.plan || "").trim();

    if (!name || !email || !company || !comments || !plan) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const application = await prisma.application.create({
      data: {
        name,
        email,
        company,
        comments,
        desiredPlan: normalizePlan(plan),
      },
    });

    return NextResponse.json({
      success: true,
      applicationId: application.id,
    });
  } catch (error) {
    console.error("APPLICATION ERROR:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save application" },
      { status: 500 }
    );
  }
}