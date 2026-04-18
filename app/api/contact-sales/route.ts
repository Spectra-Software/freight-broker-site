import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

type PlanTier = "BASIC" | "MID" | "PREMIUM";

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

    // ✅ Save to DB
    const application = await prisma.application.create({
      data: {
        name,
        email,
        company,
        comments,
        desiredPlan: normalizePlan(plan),
      },
    });

    // ✅ Setup email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // ✅ Send email TO YOU
    await transporter.sendMail({
      from: `"Broker Buddy" <${process.env.SMTP_FROM}>`,
      to: process.env.SMTP_FROM,
      subject: "🚛 New Contact Sales Submission",
      html: `
        <h2>New Application Submitted</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${company}</p>
        <p><strong>Plan:</strong> ${plan}</p>
        <p><strong>Comments:</strong></p>
        <p>${comments}</p>
      `,
    });

    // ✅ OPTIONAL: Send confirmation to user
    await transporter.sendMail({
      from: `"Broker Buddy" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: "We received your application",
      html: `
        <h2>Thanks for reaching out</h2>
        <p>Hi ${name},</p>
        <p>We received your application and will review it shortly.</p>
        <p>You’ll hear from us soon.</p>
      `,
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