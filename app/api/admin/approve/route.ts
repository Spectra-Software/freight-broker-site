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

    // 1. get application
    const app = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!app) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 }
      );
    }

    // 2. generate invite token
    const token = crypto.randomBytes(32).toString("hex");

    // 3. create invite
    await prisma.invite.create({
      data: {
        email: app.email,
        token,
        plan: app.desiredPlan,
      },
    });

    // 4. mark approved
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: "APPROVED" },
    });

    const inviteLink = `${process.env.NEXTAUTH_URL}/create-account?token=${token}`;

    // 5. email setup
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // 6. send invite email
    await transporter.sendMail({
      from: `"Broker Buddy" <${process.env.SMTP_FROM}>`,
      to: app.email,
      subject: "You're Approved — Create Your Account",
      html: `
        <div style="font-family: sans-serif">
          <h2>You're Approved 🎉</h2>
          <p>Your application has been approved.</p>

          <p>Click below to create your account:</p>

          <a href="${inviteLink}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:white;border-radius:8px;text-decoration:none;">
            Create Account
          </a>

          <p style="margin-top:20px;font-size:12px;color:#666;">
            If the button doesn't work, use this link:<br/>
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
    console.error("APPROVE ERROR:", err);

    return NextResponse.json(
      { success: false, error: "Failed to approve application" },
      { status: 500 }
    );
  }
}