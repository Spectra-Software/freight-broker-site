import { NextResponse } from "next/server";

// Returns the current U.S. national average diesel price per gallon.
// If an EIA API key is provided via EIA_API_KEY env var, the endpoint will query the EIA API.
// Otherwise the endpoint returns a sensible default and an informational flag.

export async function GET() {
  try {
    const apiKey = process.env.EIA_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ price: 3.5, currency: "USD", source: "default", note: "EIA_API_KEY not configured" });
    }

    // Use native v2 route for U.S. on-highway diesel weekly average (dollars per gallon)
    // Series facet: EMM_EPM0_PTE_NUS_DPG under petroleum/pri/fuel
    const url = `https://api.eia.gov/v2/petroleum/pri/fuel/data?api_key=${encodeURIComponent(apiKey)}&facets[series][]=EMM_EPM0_PTE_NUS_DPG&frequency=weekly&sort[0][column]=period&sort[0][direction]=desc&length=1`;

    const res = await fetch(url, { next: { revalidate: 60 * 60 } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("EIA fetch failed", res.status, text);
      return NextResponse.json({ price: 3.5, currency: "USD", source: "eia", error: "failed to fetch", status: res.status });
    }

    const data = await res.json();
    // v2 response format: { response: { data: [{ period, value, ... }] } }
    const rows = data?.response?.data && Array.isArray(data.response.data) ? data.response.data : [];
    const latest = rows[0] ?? null;

    if (!latest || (typeof latest.value !== "number" && typeof latest.value !== "string")) {
      console.error("EIA no valid data in response", JSON.stringify(data).slice(0, 500));
      return NextResponse.json({ price: 3.5, currency: "USD", source: "eia", error: "no data" });
    }

    const price = Number(latest.value);

    return NextResponse.json({ price, currency: "USD", source: "eia", period: latest.period });
  } catch (err) {
    console.error("FUEL API ERROR:", err);
    return NextResponse.json({ price: 3.5, currency: "USD", source: "default", error: err instanceof Error ? err.message : String(err) });
  }
}
