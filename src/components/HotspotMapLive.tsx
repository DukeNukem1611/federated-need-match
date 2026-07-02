// Live Google Maps hotspot view. Drop-in replacement for the SVG HotspotMap:
// same `needs` shape + urgency colors, but with real geography, zoom/pan,
// marker clustering (count bubbles), and an InfoWindow showing NGO + details.
// Used by /network when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import type { Marker } from "@googlemaps/markerclusterer";
import type { NeedCategory, Urgency } from "@prisma/client";

type Need = {
  id: string;
  latitude: number;
  longitude: number;
  urgency: Urgency;
  category: NeedCategory;
  ngo: { name: string };
  rawText: string;
};

const URGENCY_RADIUS: Record<Urgency, number> = {
  LOW: 7, MEDIUM: 10, HIGH: 14, CRITICAL: 18,
};

const URGENCY_FILL: Record<Urgency, string> = {
  LOW:      "#64748b",
  MEDIUM:   "#eab308",
  HIGH:     "#f97316",
  CRITICAL: "#ef4444",
};

const URGENCY_LABEL: Record<Urgency, string> = {
  LOW:      "border-black/10 bg-black/5 text-on-surface-variant",
  MEDIUM:   "border-yellow-400/30 bg-yellow-400/10 text-yellow-700",
  HIGH:     "border-orange-400/30 bg-orange-400/10 text-orange-700",
  CRITICAL: "border-red-400/40 bg-red-500/15 text-red-700",
};

export function HotspotMapLive({ needs, apiKey }: { needs: Need[]; apiKey: string }) {
  const center = useMemo(() => {
    if (!needs.length) return { lat: 0, lng: 0 };
    const lat = needs.reduce((s, n) => s + n.latitude, 0) / needs.length;
    const lng = needs.reduce((s, n) => s + n.longitude, 0) / needs.length;
    return { lat, lng };
  }, [needs]);

  if (needs.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-10 text-center text-sm text-on-surface-variant">
        No shared needs yet. Toggle &ldquo;Share with network&rdquo; on a need
        from any NGO dashboard to see it appear here.
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-primary-container" />
          <p className="label-caps text-surface-tint">Hotspot Telemetry</p>
        </div>
        <span className="mono-data text-[11px] text-on-surface-variant">
          {needs.length} {needs.length === 1 ? "signal" : "signals"}
        </span>
      </div>

      <div className="h-[500px] w-full">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={center}
            defaultZoom={11}
            mapId="DEMO_MAP_ID"
            colorScheme="LIGHT"
            gestureHandling="greedy"
            disableDefaultUI={false}
            clickableIcons={false}
            style={{ width: "100%", height: "100%" }}
          >
            <ClusteredBlips needs={needs} />
          </Map>
        </APIProvider>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-black/5 px-5 py-3 text-xs">
        <span className="label-caps">Urgency</span>
        {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as Urgency[]).map(u => (
          <span key={u} className="flex items-center gap-1.5">
            <span
              className="inline-block rounded-full ring-1 ring-black/20"
              style={{
                width: URGENCY_RADIUS[u],
                height: URGENCY_RADIUS[u],
                background: URGENCY_FILL[u],
              }}
            />
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${URGENCY_LABEL[u]}`}
            >
              {u}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Renders one AdvancedMarker per need, registers them with a MarkerClusterer
// (so dense areas collapse into count bubbles), fits the viewport to the data,
// and shows an InfoWindow for the selected need.
function ClusteredBlips({ needs }: { needs: Need[] }) {
  const map = useMap();
  // Markers live in a ref (not state): the AdvancedMarker `ref` callback fires
  // with null→value on every render, so mutating state there would loop. We
  // re-sync the clusterer from a data-driven effect instead.
  const markersRef = useRef<Record<string, Marker>>({});
  const clusterer = useRef<MarkerClusterer | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Create the clusterer once the map is ready.
  useEffect(() => {
    if (!map) return;
    if (!clusterer.current) {
      clusterer.current = new MarkerClusterer({ map });
    }
  }, [map]);

  // On map/data change: re-sync the clusterer's markers and fit the viewport to
  // all signals. Zoom is clamped so a single point doesn't slam to street level.
  useEffect(() => {
    const c = clusterer.current;
    if (!map || !c) return;

    c.clearMarkers();
    c.addMarkers(Object.values(markersRef.current));

    if (needs.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    needs.forEach(n => bounds.extend({ lat: n.latitude, lng: n.longitude }));
    map.fitBounds(bounds, 72);
    const listener = google.maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? 0) > 14) map.setZoom(14);
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, needs]);

  const setMarkerRef = useCallback((marker: Marker | null, id: string) => {
    if (marker) {
      markersRef.current[id] = marker;
    } else {
      delete markersRef.current[id];
    }
  }, []);

  const selected = needs.find(n => n.id === selectedId) ?? null;

  return (
    <>
      {needs.map(n => (
        <AdvancedMarker
          key={n.id}
          position={{ lat: n.latitude, lng: n.longitude }}
          ref={marker => setMarkerRef(marker, n.id)}
          onClick={() => setSelectedId(n.id)}
        >
          <Blip urgency={n.urgency} />
        </AdvancedMarker>
      ))}

      {selected && (
        <InfoWindow
          position={{ lat: selected.latitude, lng: selected.longitude }}
          pixelOffset={[0, -20]}
          onCloseClick={() => setSelectedId(null)}
        >
          <div style={{ maxWidth: 240, color: "#0d1c2d", fontFamily: "Inter, sans-serif" }}>
            <div
              style={{
                display: "inline-block",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "2px 8px",
                borderRadius: 999,
                color: "#fff",
                background: URGENCY_FILL[selected.urgency],
                marginBottom: 6,
              }}
            >
              {selected.urgency}
            </div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
              {selected.ngo.name}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.4 }}>{selected.rawText}</div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function Blip({ urgency }: { urgency: Urgency }) {
  const r = URGENCY_RADIUS[urgency];
  const color = URGENCY_FILL[urgency];
  const size = r * 2;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: color,
        border: "2px solid rgba(255,255,255,0.85)",
        boxShadow: `0 0 0 ${r}px ${color}22`,
        cursor: "pointer",
      }}
    />
  );
}
