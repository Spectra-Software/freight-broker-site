import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ valid: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const reply = typeof (body as any).reply === "string" ? (body as any).reply : null;
    const leads = Array.isArray((body as any).leads) ? (body as any).leads : null;

    if (reply === null || leads === null) {
      return NextResponse.json({ valid: false, error: "Missing reply or leads", reply, leads }, { status: 400 });
    }

    // Basic schema checks for leads
    const leadErrors: any[] = [];

    leads.forEach((lead: any, idx: number) => {
      if (!lead || typeof lead !== "object") {
        leadErrors.push({ idx, error: "Lead is not an object" });
        return;
      }

      if (!lead.company || typeof lead.company !== "string") leadErrors.push({ idx, field: "company" });
      if (!lead.email || typeof lead.email !== "string") leadErrors.push({ idx, field: "email" });
      if (!lead.draft || typeof lead.draft !== "object") leadErrors.push({ idx, field: "draft" });
      else {
        if (!lead.draft.subject || typeof lead.draft.subject !== "string") leadErrors.push({ idx, field: "draft.subject" });
        if (!lead.draft.body || typeof lead.draft.body !== "string") leadErrors.push({ idx, field: "draft.body" });
      }
    });

    if (leadErrors.length) {
      return NextResponse.json({ valid: false, error: "Lead schema validation failed", leadErrors }, { status: 400 });
    }

    return NextResponse.json({ valid: true });
  } catch (err: unknown) {
    console.error("AI VALIDATE ERROR:", err);
    return NextResponse.json({ valid: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
