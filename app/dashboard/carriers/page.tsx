"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface CarrierData {
  dotNumber?: string;
  mcMxffNumber?: string;
  legalName?: string;
  dbaName?: string;
  phyStreet?: string;
  mailStreet?: string;
  phone?: string;
  dotStatus?: string;
  operatingAuthorityStatus?: string;
  oosDate?: string;
  safetyRating?: string;
  powerUnits?: string;
  drivers?: string;
  mcs150FormDate?: string;
  operationClassification?: string;
  carrierOperation?: string;
  cargoCarried?: string;
  entityType?: string;
  [key: string]: string | undefined;
}

interface RiskFlag {
  level: "high" | "medium" | "low";
  label: string;
  detail: string;
}

function assessRisk(c: CarrierData): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const pu = parseInt(c.powerUnits || "0", 10);
  const drivers = parseInt(c.drivers || "0", 10);
  const dotStatus = c.dotStatus?.toUpperCase() || "";
  const authStatus = c.operatingAuthorityStatus?.toUpperCase() || "";
  const opClass = c.operationClassification?.toLowerCase() || "";
  const carrierOp = c.carrierOperation?.toLowerCase() || "";
  const isForHire = opClass.includes("for hire") || opClass.includes("auth. for hire");
  const isInterstate = carrierOp.includes("interstate");
  const isBroker = c.entityType?.toUpperCase() === "BROKER";
  const isCarrier = c.entityType?.toUpperCase() === "CARRIER";

  // --- HIGH RISK FLAGS ---

  if (dotStatus === "OUT-OF-SERVICE") {
    flags.push({ level: "high", label: "Out of Service", detail: "Carrier is under an out-of-service order and is not authorized to operate." });
  }

  if (dotStatus === "INACTIVE") {
    flags.push({ level: "high", label: "USDOT Inactive", detail: "DOT number is inactive — biennial MCS-150 update not completed. Carrier may not be operating legally." });
  }

  if (authStatus.includes("NOT AUTHORIZED") && isForHire && isInterstate) {
    flags.push({ level: "high", label: "No Operating Authority", detail: "Interstate for-hire carrier without operating authority. Cannot legally broker or haul freight interstate." });
  }

  // Double brokering risk: broker with very few/no power units but has carrier authority
  if (isBroker && pu === 0) {
    flags.push({ level: "high", label: "Double Brokering Risk", detail: "Broker entity with zero power units — may re-broker loads rather than move freight with own equipment." });
  }

  // Carrier with 1 power unit and for-hire authority — potential shell
  if (isCarrier && isForHire && pu <= 1 && isInterstate) {
    flags.push({ level: "high", label: "Double Brokering Risk", detail: `For-hire interstate carrier with only ${pu} power unit(s). May be a shell company used for double brokering.` });
  }

  // Physical and mailing addresses in different states
  const phyState = c.phyStreet?.match(/[A-Z]{2}\s+\d{5}/)?.[0]?.slice(0, 2) || "";
  const mailState = c.mailStreet?.match(/[A-Z]{2}\s+\d{5}/)?.[0]?.slice(0, 2) || "";
  if (phyState && mailState && phyState !== mailState) {
    flags.push({ level: "high", label: "Address Mismatch", detail: "Physical and mailing addresses are in different states — potential shell company indicator." });
  }

  // --- MEDIUM RISK FLAGS ---

  if (c.mcs150FormDate) {
    const formDate = new Date(c.mcs150FormDate);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    if (formDate < twoYearsAgo) {
      flags.push({ level: "medium", label: "Outdated MCS-150", detail: `MCS-150 form last updated ${c.mcs150FormDate}. Carriers must update biennially. Registration may be outdated.` });
    }
  }

  if (pu > 0 && drivers > 0 && pu > drivers * 2) {
    flags.push({ level: "medium", label: "Driver Shortage", detail: `${pu} power units but only ${drivers} driver(s) listed. May not have capacity to operate listed equipment.` });
  }

  if (!c.safetyRating) {
    flags.push({ level: "medium", label: "No Safety Rating", detail: "Carrier has not received a FMCSA safety rating. Could indicate a new entrant or unreviewed carrier." });
  }

  if (c.safetyRating?.toUpperCase() === "CONDITIONAL") {
    flags.push({ level: "medium", label: "Conditional Safety Rating", detail: "Carrier has a conditional safety rating — FMCSA found widespread safety deficiencies." });
  }

  if (c.safetyRating?.toUpperCase() === "UNSATISFACTORY") {
    flags.push({ level: "high", label: "Unsatisfactory Safety Rating", detail: "Carrier has an unsatisfactory safety rating. This is the worst rating and indicates severe safety problems." });
  }

  // --- LOW RISK / INFO FLAGS ---

  if (pu === 0 && drivers === 0 && isCarrier) {
    flags.push({ level: "low", label: "Zero Units/Drivers", detail: "No power units or drivers listed. May be a new entrant, broker-only entity, or inactive carrier." });
  }

  if (dotStatus === "ACTIVE" && authStatus.includes("AUTHORIZED") && flags.length === 0) {
    flags.push({ level: "low", label: "Appears Compliant", detail: "Active DOT number, authorized operating authority, and no risk flags detected from FMCSA data." });
  }

  return flags;
}

function getOverallRisk(flags: RiskFlag[]): "high" | "medium" | "low" | "clear" {
  if (flags.some(f => f.level === "high")) return "high";
  if (flags.some(f => f.level === "medium")) return "medium";
  if (flags.some(f => f.level === "low" && f.label !== "Appears Compliant")) return "low";
  return "clear";
}

const RISK_COLORS = {
  high: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", badge: "bg-red-500/20 text-red-400" },
  medium: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-400", badge: "bg-yellow-500/20 text-yellow-400" },
  low: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", badge: "bg-blue-500/20 text-blue-400" },
  clear: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-400", badge: "bg-green-500/20 text-green-400" },
};

export default function CarriersPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"dot" | "mc">("dot");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carriers, setCarriers] = useState<CarrierData[]>([]);
  const [initialLookupDone, setInitialLookupDone] = useState(false);

  async function handleLookup() {
    if (!query.trim()) return;
    setError(null);
    setCarriers([]);
    setLoading(true);

    try {
      const param = searchType === "dot" ? `dot=${encodeURIComponent(query.trim())}` : `mc=${encodeURIComponent(query.trim())}`;
      const res = await fetch(`/api/carriers/lookup?${param}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Lookup failed");
      } else if (!data.carriers?.length) {
        setError("No carrier found with that number.");
      } else {
        setCarriers(data.carriers);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const dot = searchParams.get("dot");
    const mc = searchParams.get("mc");
    if (dot) {
      setQuery(dot);
      setSearchType("dot");
    } else if (mc) {
      setQuery(mc);
      setSearchType("mc");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!initialLookupDone && query) {
      setInitialLookupDone(true);
      handleLookup();
    }
  }, [query, initialLookupDone]);

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-4">
      {/* Search Panel */}
      <div className="w-80 shrink-0 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <h1 className="text-xl font-bold">Carrier Lookup</h1>
        <p className="text-sm text-gray-400">Look up carrier information and risk assessment by USDOT or MC number.</p>

        <div>
          <label className="text-xs text-gray-400">Search by</label>
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => setSearchType("dot")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${searchType === "dot" ? "bg-blue-600 text-white" : "border border-white/10 text-gray-400 hover:text-white"}`}
            >
              USDOT
            </button>
            <button
              onClick={() => setSearchType("mc")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${searchType === "mc" ? "bg-blue-600 text-white" : "border border-white/10 text-gray-400 hover:text-white"}`}
            >
              MC Number
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-400">{searchType === "dot" ? "USDOT Number" : "MC Number"}</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            placeholder={searchType === "dot" ? "e.g., 1234567" : "e.g., MC-123456"}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm text-white"
          />
        </div>

        <div>
          <button onClick={handleLookup} disabled={loading} className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Searching\u2026" : "Look Up Carrier"}
          </button>
        </div>

        {error && <div className="text-sm text-rose-400">{error}</div>}
      </div>

      {/* Results Panel */}
      <div className="flex-1 overflow-y-auto">
        {carriers.length === 0 && !error && (
          <div className="flex h-full items-center justify-center text-gray-500 text-sm">
            Enter a USDOT or MC number to look up a carrier
          </div>
        )}

        {carriers.map((c, i) => {
          const flags = assessRisk(c);
          const overallRisk = getOverallRisk(flags);
          const colors = RISK_COLORS[overallRisk];
          const dotActive = c.dotStatus?.toUpperCase() === "ACTIVE";
          const oos = c.dotStatus?.toUpperCase() === "OUT-OF-SERVICE";

          return (
            <div key={i} className="space-y-4 pb-8">
              {/* Header */}
              <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-5`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{c.legalName || c.dbaName || "Unknown Carrier"}</h2>
                    {c.dbaName && c.legalName && <p className="text-sm text-gray-400">DBA: {c.dbaName}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${colors.badge}`}>
                      {overallRisk === "high" ? "HIGH RISK" : overallRisk === "medium" ? "MEDIUM RISK" : overallRisk === "low" ? "LOW RISK" : "CLEARED"}
                    </span>
                    {oos && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">OUT OF SERVICE</span>}
                    {dotActive && !oos && <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-semibold text-green-400">DOT ACTIVE</span>}
                  </div>
                </div>

                {/* Key stats */}
                <div className="mt-4 grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">USDOT Number</p>
                    <p className="text-lg font-bold text-white">{c.dotNumber || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">MC/MX Number</p>
                    <p className="text-lg font-bold text-white">{c.mcMxffNumber || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Power Units</p>
                    <p className="text-lg font-bold text-white">{c.powerUnits || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Drivers</p>
                    <p className="text-lg font-bold text-white">{c.drivers || "\u2014"}</p>
                  </div>
                </div>
              </div>

              {/* Risk Flags */}
              {flags.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-bold text-white mb-3">Risk Assessment</h3>
                  <div className="space-y-2">
                    {flags.map((flag, fi) => {
                      const fc = RISK_COLORS[flag.level];
                      return (
                        <div key={fi} className={`rounded-xl border ${fc.border} ${fc.bg} p-3`}>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${fc.badge}`}>
                              {flag.level === "high" ? "HIGH" : flag.level === "medium" ? "MED" : "INFO"}
                            </span>
                            <span className={`text-sm font-semibold ${fc.text}`}>{flag.label}</span>
                          </div>
                          <p className="mt-1 text-xs text-gray-300">{flag.detail}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Company Information */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-sm font-bold text-white mb-3">Company Information</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <p className="text-xs text-gray-400">Entity Type</p>
                    <p className="text-sm text-white">{c.entityType || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">USDOT Status</p>
                    <p className="text-sm text-white">{c.dotStatus || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Operating Authority</p>
                    <p className="text-sm text-white">{c.operatingAuthorityStatus || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Out of Service Date</p>
                    <p className="text-sm text-white">{c.oosDate || "None"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">MCS-150 Form Date</p>
                    <p className="text-sm text-white">{c.mcs150FormDate || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Safety Rating</p>
                    <p className="text-sm text-white">{c.safetyRating || "Not Rated"}</p>
                  </div>
                </div>
              </div>

              {/* Addresses & Contact */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-sm font-bold text-white mb-3">Addresses & Contact</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <p className="text-xs text-gray-400">Physical Address</p>
                    <p className="text-sm text-white">{c.phyStreet || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Mailing Address</p>
                    <p className="text-sm text-white">{c.mailStreet || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Phone</p>
                    <p className="text-sm text-white">{c.phone || "\u2014"}</p>
                  </div>
                </div>
              </div>

              {/* Operations & Cargo */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-sm font-bold text-white mb-3">Operations & Cargo</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400">Operation Classification</p>
                    <p className="text-sm text-white">{c.operationClassification || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Carrier Operation</p>
                    <p className="text-sm text-white">{c.carrierOperation || "\u2014"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Cargo Carried</p>
                    <p className="text-sm text-white">{c.cargoCarried || "\u2014"}</p>
                  </div>
                </div>
              </div>

              {/* FMCSA Links */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-sm font-bold text-white mb-3">External Links</h3>
                <div className="flex flex-wrap gap-3">
                  {c.dotNumber && (
                    <a
                      href={`https://safer.fmcsa.dot.gov/query.asp?query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${c.dotNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/5"
                    >
                      SAFER Snapshot
                    </a>
                  )}
                  {c.dotNumber && (
                    <a
                      href={`https://ai.fmcsa.dot.gov/sms/intervention.aspx?DOT=${c.dotNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/5"
                    >
                      SMS Results
                    </a>
                  )}
                  {c.dotNumber && (
                    <a
                      href={`https://li-public.fmcsa.dot.gov/LIVIEW/pkg_carrquery.prc_carrlist?n_dotno=${c.dotNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/5"
                    >
                      Licensing & Insurance
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}