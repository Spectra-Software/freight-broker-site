import { NextResponse } from "next/server";

// Carrier lookup using FMCSA SAFER system.
// Accepts ?dot=XXX or ?mc=XXX query params.
// Parses the SAFER Company Snapshot HTML page.

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function extractField(html: string, label: string): string {
  // SAFER HTML pattern: <TH ... class="querylabelbkg" ...>Label</TH> ... <TD class="queryfield" ...>value</TD>
  const regex = new RegExp(
    `<TH[^>]*class="querylabelbkg"[^>]*>[\\s\\S]*?${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?</TH>\\s*<TD[^>]*class="queryfield"[^>]*>([\\s\\S]*?)</TD>`,
    "i"
  );
  const m = html.match(regex);
  return m ? stripHtml(m[1]) : "";
}

function extractFieldWide(html: string, label: string): string {
  // Same but allows colspan and other attributes on the TD
  const regex = new RegExp(
    `<TH[^>]*class="querylabelbkg"[^>]*>[\\s\\S]*?${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?</TH>\\s*<TD[^>]*>([\\s\\S]*?)</TD>`,
    "i"
  );
  const m = html.match(regex);
  return m ? stripHtml(m[1]) : "";
}

function extractCheckedItems(html: string, sectionLabel: string): string[] {
  // Find a section like "Operation Classification" then find rows with X in the first cell
  const sectionRegex = new RegExp(
    `${sectionLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?<TABLE[^>]*>[\\s\\S]*?</TABLE>`,
    "i"
  );
  const sectionMatch = html.match(sectionRegex);
  if (!sectionMatch) return [];

  const section = sectionMatch[0];
  const items: string[] = [];
  // Match <TD class="queryfield" ...>X</TD> followed by label text
  const rowRegex = /<TD[^>]*class="queryfield"[^>]*>\s*X\s*<\/TD>\s*<TD[^>]*>([\s\S]*?)<\/TD>/gi;
  let m;
  while ((m = rowRegex.exec(section)) !== null) {
    items.push(stripHtml(m[1]));
  }
  return items;
}

function extractMxNumber(html: string): string {
  // MC/MX/FF Number is in a special format: <TD>MC-XXXXX</TD>
  const m = html.match(/<TD[^>]*class="queryfield"[^>]*>\s*(MC-?\d+)\s*&nbsp;/i);
  return m ? m[1] : "";
}

function extractOperatingAuthority(html: string): string {
  // Operating Authority Status has its own section with bold text
  const m = html.match(/Operating Authority Status:[\s\S]*?<TD[^>]*class="queryfield"[^>]*>([\s\S]*?)<\/TD>/i);
  if (!m) return "";
  // Extract the main status (AUTHORIZED FOR ..., NOT AUTHORIZED, etc.)
  const statusMatch = m[1].match(/<b>\s*([\s\S]*?)\s*<\/b>/i);
  return statusMatch ? stripHtml(statusMatch[1]) : stripHtml(m[1]).split("*")[0].trim();
}

function parseSaferHtml(html: string) {
  const carrier: Record<string, string> = {};

  carrier.entityType = extractField(html, "Entity Type");
  carrier.dotStatus = extractField(html, "USDOT Status");
  carrier.oosDate = extractFieldWide(html, "Out of Service Date");
  carrier.dotNumber = extractField(html, "USDOT Number");
  carrier.mcs150FormDate = extractField(html, "MCS-150 Form Date");
  carrier.operatingAuthorityStatus = extractOperatingAuthority(html);
  carrier.mcMxffNumber = extractMxNumber(html);
  carrier.legalName = extractFieldWide(html, "Legal Name");
  carrier.dbaName = extractFieldWide(html, "DBA Name");
  carrier.phyStreet = extractFieldWide(html, "Physical Address");
  carrier.phone = extractFieldWide(html, "Phone");
  carrier.mailStreet = extractFieldWide(html, "Mailing Address");
  carrier.powerUnits = extractField(html, "Power Units");
  carrier.drivers = extractField(html, "Drivers");

  // Operation Classification - extract checked items
  const opClass = extractCheckedItems(html, "Operation Classification");
  if (opClass.length) carrier.operationClassification = opClass.join(", ");

  // Carrier Operation - extract checked items
  const carrierOp = extractCheckedItems(html, "Carrier Operation");
  if (carrierOp.length) carrier.carrierOperation = carrierOp.join(", ");

  // Cargo Carried - extract checked items
  const cargo = extractCheckedItems(html, "Cargo Carried");
  if (cargo.length) carrier.cargoCarried = cargo.join(", ");

  // Safety Rating
  const rating = extractFieldWide(html, "Rating");
  if (rating && rating !== "None") carrier.safetyRating = rating;

  // Clean up "None" values
  for (const key of Object.keys(carrier)) {
    if (carrier[key] === "None" || carrier[key] === "--" || carrier[key] === "&nbsp;") {
      delete carrier[key];
    }
  }

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
