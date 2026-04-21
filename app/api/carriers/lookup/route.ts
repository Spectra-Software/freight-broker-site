import { NextResponse } from "next/server";

// Carrier lookup using FMCSA SAFER system.
// Accepts ?dot=XXX or ?mc=XXX query params.
// Parses the SAFER Company Snapshot HTML page.

function extractField(html: string, label: string): string {
  // SAFER pages use pattern: <Label> ...value...
  // Try matching label followed by content in the next cell/td
  const regex = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*</td>\\s*<td[^>]*>\\s*([\\s\\S]*?)\\s*</td>`, "i");
  const m = html.match(regex);
  if (m) return m[1].replace(/<[^>]*>/g, "").trim();
  // Fallback: label followed by colon or bold text
  const regex2 = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[:\\s]*([\\w\\s,.-]+)`, "i");
  const m2 = html.match(regex2);
  return m2 ? m2[1].trim() : "";
}

function parseSaferHtml(html: string) {
  // Extract key fields from the SAFER Company Snapshot HTML
  const carrier: Record<string, string> = {};

  // USDOT Number
  const dotMatch = html.match(/USDOT\s*Number[:\s]*<\/?\w*[^>]*>\s*(\d+)/i) ?? html.match(/USDOT\s*#\s*[:\s]*(\d+)/i);
  if (dotMatch) carrier.dotNumber = dotMatch[1];

  // MC/MX Number
  const mcMatch = html.match(/MC[-/MX\s]*Number[^<]*?[:\s]*(MC-?\d+)/i) ?? html.match(/\b(MC-\d+)\b/i);
  if (mcMatch) carrier.mcMxffNumber = mcMatch[1];

  // Legal Name
  const legalMatch = html.match(/Legal\s*Name[:\s]*<\/?\w*[^>]*>\s*([A-Za-z0-9\s,.&'-]+)/i);
  if (legalMatch) carrier.legalName = legalMatch[1].trim();

  // DBA Name
  const dbaMatch = html.match(/DBA\s*Name[:\s]*<\/?\w*[^>]*>\s*([A-Za-z0-9\s,.&'-]+)/i);
  if (dbaMatch) carrier.dbaName = dbaMatch[1].trim();

  // Physical Address
  const phyMatch = html.match(/Physical\s*Address[:\s]*<\/?\w*[^>]*>\s*([\s\S]*?)(?:<br\s*\/?>\s*Phone|Mailing\s*Address)/i);
  if (phyMatch) carrier.phyStreet = phyMatch[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

  // Mailing Address
  const mailMatch = html.match(/Mailing\s*Address[:\s]*<\/?\w*[^>]*>\s*([\s\S]*?)(?:<br\s*\/?>\s*DUNS|Power\s*Units)/i);
  if (mailMatch) carrier.mailStreet = mailMatch[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

  // Phone
  const phoneMatch = html.match(/Phone[:\s]*<\/?\w*[^>]*>\s*([\d()-\s]+)/i);
  if (phoneMatch) carrier.phone = phoneMatch[1].trim();

  // Power Units
  const puMatch = html.match(/Power\s*Units[:\s]*<\/?\w*[^>]*>\s*(\d+)/i);
  if (puMatch) carrier.powerUnits = puMatch[1];

  // Drivers
  const drMatch = html.match(/Drivers[:\s]*<\/?\w*[^>]*>\s*(\d+)/i);
  if (drMatch) carrier.drivers = drMatch[1];

  // USDOT Status
  const statusMatch = html.match(/USDOT\s*Status[:\s]*<\/?\w*[^>]*>\s*(\w+)/i);
  if (statusMatch) carrier.dotStatus = statusMatch[1];

  // Operating Authority Status
  const oaMatch = html.match(/Operating\s*Authority\s*Status[:\s]*<\/?\w*[^>]*>\s*([A-Z\s{}]+)/i);
  if (oaMatch) carrier.operatingAuthorityStatus = oaMatch[1].trim();

  // Out of Service Date
  const oosMatch = html.match(/Out\s*of\s*Service\s*Date[:\s]*<\/?\w*[^>]*>\s*([\w\s]*)/i);
  if (oosMatch) carrier.oosDate = oosMatch[1].trim();

  // MCS-150 Form Date
  const mcsMatch = html.match(/MCS-150\s*Form\s*Date[:\s]*<\/?\w*[^>]*>\s*([\d/]+)/i);
  if (mcsMatch) carrier.mcs150FormDate = mcsMatch[1].trim();

  // Safety Rating
  const ratingMatch = html.match(/Rating[:\s]*<\/?\w*[^>]*>\s*(\w+)/i);
  if (ratingMatch && ratingMatch[1] !== "None") carrier.safetyRating = ratingMatch[1];

  // Operation Classification
  const opClassMatch = html.match(/Operation\s*Classification[:\s]*<\/?\w*[^>]*>[\s\S]*?<\/td>/i);
  if (opClassMatch) carrier.operationClassification = opClassMatch[0].replace(/<[^>]*>/g, "").replace(/Operation\s*Classification/i, "").trim();

  // Carrier Operation
  const carOpMatch = html.match(/Carrier\s*Operation[:\s]*<\/?\w*[^>]*>[\s\S]*?<\/td>/i);
  if (carOpMatch) carrier.carrierOperation = carOpMatch[0].replace(/<[^>]*>/g, "").replace(/Carrier\s*Operation/i, "").trim();

  // Cargo Carried
  const cargoMatch = html.match(/Cargo\s*Carried[:\s]*<\/?\w*[^>]*>[\s\S]*?<\/td>/i);
  if (cargoMatch) carrier.cargoCarried = cargoMatch[0].replace(/<[^>]*>/g, "").replace(/Cargo\s*Carried/i, "").trim();

  // Entity Type
  const entityMatch = html.match(/Entity\s*Type[:\s]*<\/?\w*[^>]*>\s*(\w+)/i);
  if (entityMatch) carrier.entityType = entityMatch[1];

  return carrier;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dot = searchParams.get("dot")?.trim();
    const mc = searchParams.get("mc")?.trim();

    if (!dot && !mc) {
      return NextResponse.json({ error: "Provide ?dot= or ?mc= query parameter" }, { status: 400 });
    }

    // Use SAFER query endpoint
    const queryParam = dot ? "USDOT" : "MC_DOCKET";
    const queryString = dot || mc!;

    const url = `https://safer.fmcsa.dot.gov/query.asp?query_type=queryCarrierSnapshot&query_param=${queryParam}&query_string=${encodeURIComponent(queryString)}`;

    const res = await fetch(url, {
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 60 * 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "FMCSA SAFER request failed" }, { status: res.status });
    }

    const html = await res.text();

    // Check if we got a valid carrier page (not "RECORD NOT FOUND" or similar)
    if (
      html.includes("RECORD NOT FOUND") ||
      html.includes("No carrier found") ||
      html.includes("No results found") ||
      html.includes("Sorry, your query")
    ) {
      return NextResponse.json({ error: "No carrier found with that number" }, { status: 404 });
    }

    const carrier = parseSaferHtml(html);

    if (!carrier.dotNumber && !carrier.legalName) {
      console.error("SAFER parse failed, first 800 chars:", html.slice(0, 800));
      return NextResponse.json({ error: "Could not parse carrier data from SAFER" }, { status: 500 });
    }

    return NextResponse.json({ carriers: [carrier] });
  } catch (err) {
    console.error("CARRIER LOOKUP ERROR:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
