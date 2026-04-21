import { NextResponse } from "next/server";

// Returns the current U.S. national average diesel price per gallon.
// If an EIA API key is provided via EIA_API_KEY env var, the endpoint will query the EIA API.
// Otherwise the endpoint returns a sensible default and an informational flag.

export async function GET() {
  try {
    const apiKey = process.env.EIA_API_KEY;
    if (!apiKey) {
      // No API key configured: return a default value
      return NextResponse.json({ price: 3.5, currency: "USD", source: "default", note: "EIA_API_KEY not configured" });
    }

    // EIA series for U.S. on-highway diesel weekly average (dollars per gallon)
    const seriesId = "PET.EMM_EPM0_PTE_NUS_DPG.W";
    // Use v2 backward-compatibility endpoint (v1 was retired March 2023)
    const url = `https://api.eia.gov/v2/seriesid/${encodeURIComponent(seriesId)}?api_key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, { next: { revalidate: 60 * 60 } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("EIA fetch failed", res.status, text);
      return NextResponse.json({ price: 3.5, currency: "USD", source: "eia", error: "failed to fetch" });
    }

    const data = await res.json();
    // v2 response format: { response: { data: [{ period, value, ... }] } }
    const rows = data?.response?.data && Array.isArray(data.response.data) ? data.response.data : [];
    const latest = rows[0] ?? null;

    if (!latest || (typeof latest.value !== "number" && typeof latest.value !== "string")) {
      return NextResponse.json({ price: 3.5, currency: "USD", source: "eia", error: "no data" });
    }

    const price = Number(latest.value);

    return NextResponse.json({ price, currency: "USD", source: "eia", seriesId });
  } catch (err) {
    console.error("FUEL API ERROR:", err);
    return NextResponse.json({ price: 3.5, currency: "USD", source: "default", error: err instanceof Error ? err.message : String(err) });
  }
}
