"use client";

import { useState } from "react";

interface CarrierData {
  dotNumber?: string;
  mcMxffNumber?: string;
  legalName?: string;
  dbaName?: string;
  phyStreet?: string;
  phyCity?: string;
  phyState?: string;
  phyZip?: string;
  phyCountry?: string;
  mailStreet?: string;
  mailCity?: string;
  mailState?: string;
  mailZip?: string;
  mailCountry?: string;
  phone?: string;
  fax?: string;
  carrierOperation?: string;
  oosStatus?: string;
  oosDate?: string;
  safetyRating?: string;
  safetyRatingDate?: string;
  powerUnits?: string;
  drivers?: string;
  mcs150FormDate?: string;
  operationClassification?: string;
  carrierShipperOperation?: string;
  hmShipperOperation?: string;
  authorizedStates?: string;
  [key: string]: string | undefined;
}

const LABEL_MAP: Record<string, string> = {
  dotNumber: "USDOT Number",
  mcMxffNumber: "MC/MX Number",
  legalName: "Legal Name",
  dbaName: "DBA Name",
  phyStreet: "Physical Street",
  phyCity: "Physical City",
  phyState: "Physical State",
  phyZip: "Physical Zip",
  phyCountry: "Physical Country",
  mailStreet: "Mailing Street",
  mailCity: "Mailing City",
  mailState: "Mailing State",
  mailZip: "Mailing Zip",
  mailCountry: "Mailing Country",
  phone: "Phone",
  fax: "Fax",
  carrierOperation: "Carrier Operation",
  oosStatus: "Out of Service Status",
  oosDate: "Out of Service Date",
  safetyRating: "Safety Rating",
  safetyRatingDate: "Safety Rating Date",
  powerUnits: "Power Units",
  drivers: "Drivers",
  mcs150FormDate: "MCS-150 Form Date",
  operationClassification: "Operation Classification",
  carrierShipperOperation: "Carrier Shipper Operation",
  hmShipperOperation: "HM Shipper Operation",
  authorizedStates: "Authorized States",
};

const HIDDEN_FIELDS = new Set(["content"]);
const ADDRESS_FIELDS = new Set(["phyStreet", "phyCity", "phyState", "phyZip", "phyCountry", "mailStreet", "mailCity", "mailState", "mailZip", "mailCountry"]);

function formatAddress(c: CarrierData, prefix: "phy" | "mail"): string {
  const street = c[`${prefix}Street`] || "";
  const city = c[`${prefix}City`] || "";
  const state = c[`${prefix}State`] || "";
  const zip = c[`${prefix}Zip`] || "";
  const country = c[`${prefix}Country`] || "";
  const parts = [street, city && state ? `${city}, ${state}` : city || state, zip, country].filter(Boolean);
  return parts.join(" ") || "—";
}

export default function CarriersPage() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"dot" | "mc">("dot");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carriers, setCarriers] = useState<CarrierData[]>([]);

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

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-4">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4 overflow-y-auto">
        <h1 className="text-xl font-bold">Carrier Lookup</h1>
        <p className="text-sm text-gray-400">Look up carrier information by USDOT or MC number using FMCSA data.</p>

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
            {loading ? "Searching…" : "Look Up Carrier"}
          </button>
        </div>

        {error && <div className="text-sm text-rose-400">{error}</div>}

        {carriers.length > 0 && (
          <div className="space-y-4">
            {carriers.map((c, i) => {
              const oos = c.oosStatus === "Y";
              const safety = c.safetyRating?.toUpperCase();

              return (
                <div key={i} className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-white">{c.legalName || c.dbaName || "Unknown Carrier"}</h2>
                      {c.dbaName && c.legalName && <p className="text-xs text-gray-400">DBA: {c.dbaName}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {oos && (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-400">OUT OF SERVICE</span>
                      )}
                      {safety && safety !== "NONE" && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          safety === "SATISFACTORY" ? "bg-green-500/20 text-green-400" :
                          safety === "CONDITIONAL" ? "bg-yellow-500/20 text-yellow-400" :
                          safety === "UNSATISFACTORY" ? "bg-red-500/20 text-red-400" :
                          "bg-white/10 text-gray-400"
                        }`}>
                          {safety}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Key stats row */}
                  <div className="flex gap-4 text-sm">
                    <div className="text-gray-400">DOT: <span className="font-medium text-white">{c.dotNumber || "—"}</span></div>
                    <div className="text-gray-400">MC: <span className="font-medium text-white">{c.mcMxffNumber || "—"}</span></div>
                    <div className="text-gray-400">Units: <span className="font-medium text-white">{c.powerUnits || "—"}</span></div>
                    <div className="text-gray-400">Drivers: <span className="font-medium text-white">{c.drivers || "—"}</span></div>
                  </div>

                  {/* Addresses */}
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-gray-400">Physical Address</p>
                      <p className="text-sm text-white">{formatAddress(c, "phy")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Mailing Address</p>
                      <p className="text-sm text-white">{formatAddress(c, "mail")}</p>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="flex gap-4 text-sm">
                    <div className="text-gray-400">Phone: <span className="text-white">{c.phone || "—"}</span></div>
                    <div className="text-gray-400">Fax: <span className="text-white">{c.fax || "—"}</span></div>
                  </div>

                  {/* All other fields */}
                  <div className="border-t border-white/5 pt-3">
                    <p className="text-xs text-gray-400 mb-2">Additional Details</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {Object.entries(c).map(([key, value]) => {
                        if (!value || HIDDEN_FIELDS.has(key) || ADDRESS_FIELDS.has(key) || ["legalName", "dbaName", "dotNumber", "mcMxffNumber", "powerUnits", "drivers", "phone", "fax", "oosStatus", "safetyRating"].includes(key)) return null;
                        return (
                          <div key={key} className="text-xs">
                            <span className="text-gray-400">{LABEL_MAP[key] || key}: </span>
                            <span className="text-white">{value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}