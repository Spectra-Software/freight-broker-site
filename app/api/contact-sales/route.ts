import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    console.log("SENDING EMAIL...");

    const body = await req.json();
    const { name, email, company, comments, plan } = body; // ✅ ADDED PLAN

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: "austin@haulorafreight.com",
      subject: "New Contact Form Submission",
      text: `
Name: ${name}
Email: ${email}
Company: ${company}
Selected Plan: ${plan}

Comments:
${comments}
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("EMAIL ERROR:", error);

    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}