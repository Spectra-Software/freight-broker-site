import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail } from "@/lib/google/gmail";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json(
        { success: false, error: "No access token" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const { to, subject, message } = body;

    if (!to || !subject || !message) {
      return NextResponse.json(
        { success: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    const result = await sendEmail({
      accessToken: session.accessToken as string,
      to,
      subject,
      body: message,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { success: false, error: "Failed to send email" },
      { status: 500 }
    );
  }
}