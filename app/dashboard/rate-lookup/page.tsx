"use client";

import { useEffect, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

const trailerRates: Record<string, number> = {
  "dry_van": 2.75,
  "reefer": 3.1,
  "flatbed": 3.25,
  "step_deck": 3.4,
  "open_deck": 3.35,
};

export default function QuoteALanePage() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originCoord, setOriginCoord] = useState<LatLng | null>(null);
  const [destCoord, setDestCoord] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedTrailer, setSelectedTrailer] = useState<string>("dry_van");

  const [miles, setMiles] = useState<number | null>(null);
  const [estimatedRate, setEstimatedRate] = useState<number | null>(null);
  const [dieselPrice, setDieselPrice] = useState<number | null>(null);

  // Profit Calculator state
  const [profitRate, setProfitRate] = useState<string>("");
  const [profitMiles, setProfitMiles] = useState<string>("");
  const [profitFuelCost, setProfitFuelCost] = useState<string>("");

  // Route geometry from OSRM for the map to draw
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    // Load Leaflet CSS/JS from CDN once
    if (typeof window === "undefined") return;

    if (!(window as any).L) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => {
        // initialize a blank map
        if (mapRef.current && !(leafletMapRef.current)) {
          const L = (window as any).L;
          leafletMapRef.current = L.map(mapRef.current).setView([39.5, -98.35], 4);

          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "© OpenStreetMap contributors",
          }).addTo(leafletMapRef.current);
        }
      };
      document.body.appendChild(script);
    } else {
      if (mapRef.current && !(leafletMapRef.current)) {
        const L = (window as any).L;
        leafletMapRef.current = L.map(mapRef.current).setView([39.5, -98.35], 4);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap contributors",
        }).addTo(leafletMapRef.current);
      }
    }

    return () => {
      // cleanup map on unmount
      if (leafletMapRef.current) {
        try {
          leafletMapRef.current.remove();
          leafletMapRef.current = null;
        } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    if (!leafletMapRef.current) return;
    const L = (window as any).L;

    // clear previous markers and polyline
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (originCoord) {
      const m = L.marker([originCoord.lat, originCoord.lng]).addTo(leafletMapRef.current);
      markersRef.current.push(m);
    }

    if (destCoord) {
      const m = L.marker([destCoord.lat, destCoord.lng]).addTo(leafletMapRef.current);
      markersRef.current.push(m);
    }

    if (originCoord && destCoord) {
      const straightLine = [ [originCoord.lat, originCoord.lng], [destCoord.lat, destCoord.lng] ];

      if (routeCoords && routeCoords.length > 1) {
        // Draw the actual OSRM route with indigo glow
        polylineRef.current = L.polyline(routeCoords, {
          color: '#818cf8',
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(leafletMapRef.current);
        // Glow shadow underneath
        L.polyline(routeCoords, {
          color: '#6366f1',
          weight: 12,
          opacity: 0.2,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(leafletMapRef.current);
      } else {
        polylineRef.current = L.polyline(straightLine, { color: '#818cf8', weight: 5, opacity: 0.9 }).addTo(leafletMapRef.current);
      }

      // Zoom to fit the route with smooth animation
      const bounds = polylineRef.current.getBounds();
      leafletMapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 10, animate: true, duration: 1 });
    } else if (originCoord || destCoord) {
      const loc = originCoord || destCoord;
      leafletMapRef.current.setView([loc!.lat, loc!.lng], 8);
    }
  }, [originCoord, destCoord, routeCoords]);


  async function geocode(query: string) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error("Geocode failed");
    const data = await res.json();
    if (!data || !data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }

  function haversine(a: LatLng, b: LatLng) {
    const R = 3958.8; // miles
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const aVal = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return R * c;
  }

  async function handleLookup() {
    setError(null);
    setLoading(true);
    setMiles(null);
    setEstimatedRate(null);
    setRouteCoords(null);

    try {
      const o = await geocode(origin);
      const d = await geocode(destination);

      if (!o || !d) {
        setError("Could not geocode origin or destination. Try a full city, state or zip code.");
        setLoading(false);
        return;
      }

      setOriginCoord(o);
      setDestCoord(d);

      // Fetch OSRM route for actual driving miles and route geometry
      let routeMiles = haversine(o, d);
      let coords: [number, number][] | null = null;
      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${d.lng},${d.lat}?overview=full&geometries=geojson`;
        const r = await fetch(osrmUrl);
        if (r.ok) {
          const data = await r.json();
          const route = data.routes?.[0];
          if (route?.distance) {
            routeMiles = route.distance / 1609.34;
          }
          const geoCoords = route?.geometry?.coordinates;
          if (geoCoords && Array.isArray(geoCoords) && geoCoords.length) {
            coords = geoCoords.map((c: any) => [c[1], c[0]] as [number, number]);
          }
        }
      } catch (e) {
        // Fall back to haversine + straight line
      }

      const m = Number(routeMiles.toFixed(1));
      setMiles(m);
      setRouteCoords(coords);

      // Fetch national diesel price and adjust rate per mile
      let diesel = 3.5;
      try {
        const resp = await fetch("/api/fuel/national");
        const json = await resp.json();
        if (json && typeof json.price === "number") {
          diesel = Number(json.price);
          setDieselPrice(diesel);
        }
      } catch (e) {
        // ignore
      }

      const baseRatePerMile = trailerRates[selectedTrailer] ?? trailerRates.dry_van;
      const adjusted = baseRatePerMile * (diesel / 3.5);
      const totalRate = Number((m * adjusted).toFixed(2));
      setEstimatedRate(totalRate);

      // Auto-populate Profit Calculator
      const fuelCost = Number((m * diesel / 6.5).toFixed(2)); // ~6.5 mpg avg
      setProfitRate(totalRate.toString());
      setProfitMiles(m.toString());
      setProfitFuelCost(fuelCost.toString());
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-4">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        <h1 className="text-xl font-bold">Quote A Lane</h1>
        <p className="text-sm text-gray-400">Get a quick lane quote with mileage and estimated rate between origin and destination.</p>

        <div>
          <label className="text-xs text-gray-400">Origin (city, state or zip)</label>
          <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="e.g., Carthage, TX or 75633" className="mt-1 w-full rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label className="text-xs text-gray-400">Destination (city, state or zip)</label>
          <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g., Seattle, WA or 98101" className="mt-1 w-full rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm text-white" />
        </div>

        <div>
          <label className="text-xs text-gray-400">Trailer type</label>
          <select value={selectedTrailer} onChange={(e) => setSelectedTrailer(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm text-white">
            <option value="dry_van">Dry Van</option>
            <option value="reefer">Reefer</option>
            <option value="flatbed">Flatbed</option>
            <option value="step_deck">Step Deck</option>
            <option value="open_deck">Open Deck</option>
          </select>
        </div>


        <div>
          <button onClick={handleLookup} disabled={loading} className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-2 text-white">
            {loading ? "Quoting…" : "Quote Lane"}
          </button>
        </div>

        <div className="mt-3">
          <h3 className="text-sm text-gray-400">Result</h3>
          {error ? <div className="mt-2 text-sm text-rose-400">{error}</div> : null}
          {!error && miles !== null ? (
            <div className="mt-2 space-y-1">
              <div className="text-sm text-gray-300">Distance: <span className="font-medium">{miles} miles</span></div>
              <div className="text-sm text-gray-300">Estimated rate: <span className="font-medium">${estimatedRate}</span></div>
              <div className="text-xs text-gray-400">Rate assumes ${trailerRates[selectedTrailer]} / mile for selected trailer type.</div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-gray-400">No result yet.</div>
          )}
        </div>

        {/* Profit Calculator */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h2 className="text-lg font-bold text-white">Profit Calculator</h2>
          <p className="text-xs text-gray-400">Enter your rate, miles, and fuel cost to instantly see profitability.</p>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-400">Rate ($)</label>
              <input
                type="number"
                value={profitRate}
                onChange={(e) => setProfitRate(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Miles</label>
              <input
                type="number"
                value={profitMiles}
                onChange={(e) => setProfitMiles(e.target.value)}
                placeholder="0"
                min="0"
                step="1"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Fuel Cost ($)</label>
              <input
                type="number"
                value={profitFuelCost}
                onChange={(e) => setProfitFuelCost(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          {(() => {
            const rate = parseFloat(profitRate) || 0;
            const mi = parseFloat(profitMiles) || 0;
            const fuel = parseFloat(profitFuelCost) || 0;
            const netProfit = rate - fuel;
            const profitPerMile = mi > 0 ? netProfit / mi : 0;
            const fuelImpact = rate > 0 ? (fuel / rate) * 100 : 0;
            const hasInput = profitRate || profitMiles || profitFuelCost;

            if (!hasInput) return null;

            const isProfit = netProfit >= 0;
            return (
              <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Net Profit</span>
                  <span className={`text-lg font-bold ${isProfit ? "text-emerald-400" : "text-rose-400"}`}>
                    {isProfit ? "+" : ""}${netProfit.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Profit / Mile</span>
                  <span className={`text-sm font-medium ${profitPerMile >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    ${profitPerMile.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Fuel Impact</span>
                  <span className="text-sm font-medium text-amber-400">
                    {fuelImpact.toFixed(1)}% of rate
                  </span>
                </div>
                {/* Visual fuel bar */}
                <div className="mt-1">
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500/70 transition-all duration-300"
                      style={{ width: `${Math.min(fuelImpact, 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-gray-500">
                    <span>Fuel: ${fuel.toFixed(2)}</span>
                    <span>Revenue: ${rate.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

      </div>

      <div className="flex-1 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div ref={mapRef} className="h-full rounded-2xl" style={{ minHeight: 400 }} />
      </div>
    </div>
  );
}
