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
    // series_id may need to be adjusted based on availability
    const seriesId = "PET.EMM_EPM0_PTE_NUS_DPG.W";
    const url = `https://api.eia.gov/series/?api_key=${encodeURIComponent(apiKey)}&series_id=${encodeURIComponent(seriesId)}`;

    const res = await fetch(url, { next: { revalidate: 60 * 60 } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("EIA fetch failed", res.status, text);
      return NextResponse.json({ price: 3.5, currency: "USD", source: "eia", error: "failed to fetch" });
    }

    const data = await res.json();
    const series = data?.series && Array.isArray(data.series) ? data.series[0] : null;
    const latest = series?.data && Array.isArray(series.data) ? series.data[0] : null; // [date, value]

    if (!latest || typeof latest[1] !== "number") {
      return NextResponse.json({ price: 3.5, currency: "USD", source: "eia", error: "no data" });
    }

    const price = Number(latest[1]);

    return NextResponse.json({ price, currency: "USD", source: "eia", seriesId });
  } catch (err) {
    console.error("FUEL API ERROR:", err);
    return NextResponse.json({ price: 3.5, currency: "USD", source: "default", error: err instanceof Error ? err.message : String(err) });
  }
}
