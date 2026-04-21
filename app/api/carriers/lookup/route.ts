import { NextResponse } from "next/server";

// Proxy for FMCSA QCMobile API carrier lookups.
// Accepts ?dot=XXX or ?mc=XXX query params.
// Requires FMCSA_API_KEY env var.

export async function GET(request: Request) {
  try {
    const apiKey = process.env.FMCSA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "FMCSA_API_KEY not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const dot = searchParams.get("dot")?.trim();
    const mc = searchParams.get("mc")?.trim();

    if (!dot && !mc) {
      return NextResponse.json({ error: "Provide ?dot= or ?mc= query parameter" }, { status: 400 });
    }

    let url: string;
    if (dot) {
      url = `https://mobile.fmcsa.dot.gov/qc/services/carriers/usdot/${encodeURIComponent(dot)}?webKey=${encodeURIComponent(apiKey)}`;
    } else {
      url = `https://mobile.fmcsa.dot.gov/qc/services/carriers/docket-number/${encodeURIComponent(mc!)}?webKey=${encodeURIComponent(apiKey)}`;
    }

    const res = await fetch(url, { next: { revalidate: 60 * 60 } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("FMCSA fetch failed", res.status, text);
      return NextResponse.json({ error: "FMCSA API request failed", status: res.status }, { status: res.status });
    }

    const data = await res.json();

    // Try multiple response formats FMCSA may return
    const carrier = data?.content?.carrier ?? data?.carrier ?? data?.content ?? null;

    if (!carrier) {
      console.error("FMCSA no carrier in response", JSON.stringify(data).slice(0, 800));
      return NextResponse.json({ error: "No carrier found", raw: JSON.stringify(data).slice(0, 800) }, { status: 404 });
    }

    // Normalize to always return an array
    const carriers = Array.isArray(carrier) ? carrier : [carrier];
    return NextResponse.json({ carriers });
  } catch (err) {
    console.error("CARRIER LOOKUP ERROR:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
