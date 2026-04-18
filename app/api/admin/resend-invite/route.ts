import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const { applicationId } = await req.json();

    if (!applicationId) {
      return NextResponse.json(
        { success: false, error: "Missing applicationId" },
        { status: 400 }
      );
    }

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!app) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    // 1. invalidate old invites (optional but recommended)
    await prisma.invite.updateMany({
      where: { email: app.email, used: false },
      data: { used: true },
    });

    // 2. create new token
    const token = crypto.randomBytes(32).toString("hex");

    await prisma.invite.create({
      data: {
        email: app.email,
        token,
        plan: app.desiredPlan,
      },
    });

    const baseUrl =
      process.env.APP_URL ||
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    const inviteLink = `${baseUrl}/create-account?token=${token}`;

    // 3. send email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Broker Buddy" <${process.env.SMTP_FROM}>`,
      to: app.email,
      subject: "Your Account Link Has Been Reissued",
      html: `
        <div style="font-family: sans-serif">
          <h2>Account Link Reissued 🔁</h2>

          <p>Your account creation link has been regenerated.</p>

          <a href="${inviteLink}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;">
            Create Account
          </a>

          <p style="margin-top:20px;font-size:12px;color:#666;">
            ${inviteLink}
          </p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      inviteLink,
    });
  } catch (err) {
    console.error("RESEND INVITE ERROR:", err);

    return NextResponse.json(
      { success: false, error: "Failed to resend invite" },
      { status: 500 }
    );
  }
}