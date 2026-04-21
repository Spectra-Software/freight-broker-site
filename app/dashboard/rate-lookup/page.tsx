"use client";

import { useEffect, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

const trailerRates: Record<string, number> = {
  "dry_van": 1.6,
  "reefer": 1.9,
  "flatbed": 2.2,
  "step_deck": 2.35,
  "open_deck": 2.3,
};

export default function QuoteALanePage() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originCoord, setOriginCoord] = useState<LatLng | null>(null);
  const [destCoord, setDestCoord] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedTrailer, setSelectedTrailer] = useState<string>("dry_van");
  const [selectedCarrier, setSelectedCarrier] = useState<string>("Any Carrier");
  const [availableCarriers, setAvailableCarriers] = useState<{ id: string; name: string }[]>([]);

  const [miles, setMiles] = useState<number | null>(null);
  const [estimatedRate, setEstimatedRate] = useState<number | null>(null);
  const [dieselPrice, setDieselPrice] = useState<number | null>(null);

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
      const latlngs = [ [originCoord.lat, originCoord.lng], [destCoord.lat, destCoord.lng] ];
      // Draw a polyline following highways using the OSRM route service for better road routing
      (async () => {
        try {
          const url = `https://router.project-osrm.org/route/v1/driving/${originCoord.lng},${originCoord.lat};${destCoord.lng},${destCoord.lat}?overview=full&geometries=geojson`;
          const r = await fetch(url);
          if (r.ok) {
            const data = await r.json();
            const coords = data.routes?.[0]?.geometry?.coordinates || null;
            if (coords && Array.isArray(coords) && coords.length) {
              const latlngsRoute = coords.map((c: any) => [c[1], c[0]]);
              polylineRef.current = L.polyline(latlngsRoute, { color: 'blue' }).addTo(leafletMapRef.current);
            } else {
              polylineRef.current = L.polyline(latlngs, { color: 'blue' }).addTo(leafletMapRef.current);
            }
          } else {
            polylineRef.current = L.polyline(latlngs, { color: 'blue' }).addTo(leafletMapRef.current);
          }
        } catch (e) {
          polylineRef.current = L.polyline(latlngs, { color: 'blue' }).addTo(leafletMapRef.current);
        }
        if (polylineRef.current) {
          leafletMapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [40, 40] });
        }
      })();
    } else if (originCoord || destCoord) {
      const loc = originCoord || destCoord;
      leafletMapRef.current.setView([loc!.lat, loc!.lng], 8);
    }
  }, [originCoord, destCoord]);

  useEffect(() => {
    // fetch dynamic carrier list
    (async () => {
      try {
        const res = await fetch('/api/rates/carriers');
        const data = await res.json();
        if (Array.isArray(data.carriers)) setAvailableCarriers(data.carriers);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

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

      const m = haversine(o, d);
      setMiles(Number(m.toFixed(1)));

      // Fetch national diesel price and adjust rate per mile
      try {
        const resp = await fetch("/api/fuel/national");
        const json = await resp.json();
        if (json && typeof json.price === "number") {
          setDieselPrice(Number(json.price));
        }
      } catch (e) {
        // ignore
      }

      const baseRatePerMile = trailerRates[selectedTrailer] ?? trailerRates.dry_van;
      // adjust per-mile by diesel price factor (simple proportional scaling to a baseline of $3.5)
      const diesel = dieselPrice ?? 3.5;
      const adjusted = baseRatePerMile * (diesel / 3.5);
      setEstimatedRate(Number((m * adjusted).toFixed(2)));
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
          <label className="text-xs text-gray-400">Carrier</label>
          <select value={selectedCarrier} onChange={(e) => setSelectedCarrier(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm text-white">
            <option value="Any Carrier">Any Carrier</option>
            {availableCarriers.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
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

      </div>

      <div className="flex-1 rounded-3xl border border-white/10 bg-white/5 p-4">
        <div ref={mapRef} className="h-full rounded-2xl" style={{ minHeight: 400 }} />
      </div>
    </div>
  );
}
