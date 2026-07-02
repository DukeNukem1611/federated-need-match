// Lightweight SVG "hotspot map" — no leaflet dep needed for the MVP.
// Projects lat/lng into the SVG viewbox by min/max normalization, then
// renders a colored, urgency-sized circle per need. Light-theme styling
// to match the "Calm Relief" system.
"use client";

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
  LOW: 6, MEDIUM: 9, HIGH: 13, CRITICAL: 18,
};

// Neon-leaning palette that plays well on a dark background.
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

export function HotspotMap({ needs }: { needs: Need[] }) {
  if (needs.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-10 text-center text-sm text-on-surface-variant">
        No shared needs yet. Toggle &ldquo;Share with network&rdquo; on a need
        from any NGO dashboard to see it appear here.
      </div>
    );
  }

  const lats = needs.map(n => n.latitude);
  const lngs = needs.map(n => n.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const rawLatSpan = maxLat - minLat;
  const rawLngSpan = maxLng - minLng;
  const latSpan = Math.max(rawLatSpan, 0.01);
  const lngSpan = Math.max(rawLngSpan, 0.01);

  // When every signal shares a coordinate (e.g. a single shared need), the
  // raw span collapses to 0. Center that axis at 0.5 instead of normalizing
  // to 0, which would otherwise pin the dot into the bottom-left corner.
  const EPS = 1e-9;
  const W = 800, H = 500, PAD = 40;
  const project = (lat: number, lng: number) => ({
    x: PAD + (rawLngSpan < EPS ? 0.5 : (lng - minLng) / lngSpan) * (W - 2 * PAD),
    y: PAD + (rawLatSpan < EPS ? 0.5 : 1 - (lat - minLat) / latSpan) * (H - 2 * PAD),
  });

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

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(8,145,178,0.06), transparent 70%), #eef3f9",
        }}
      >
        {Array.from({ length: 9 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={(W / 8) * i} y1={0} x2={(W / 8) * i} y2={H}
            stroke="rgba(15,33,46,0.06)" strokeWidth={1}
          />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <line
            key={`h${i}`}
            x1={0} y1={(H / 5) * i} x2={W} y2={(H / 5) * i}
            stroke="rgba(15,33,46,0.06)" strokeWidth={1}
          />
        ))}

        {needs.map(n => {
          const { x, y } = project(n.latitude, n.longitude);
          const r = URGENCY_RADIUS[n.urgency];
          const color = URGENCY_FILL[n.urgency];
          return (
            <g key={n.id}>
              <circle cx={x} cy={y} r={r * 2} fill={color} opacity={0.12} />
              <circle cx={x} cy={y} r={r + 4} fill={color} opacity={0.25} />
              <circle
                cx={x} cy={y} r={r}
                fill={color}
                stroke="rgba(255,255,255,0.95)" strokeWidth={2}
              >
                <title>{`[${n.urgency}] ${n.ngo.name} — ${n.rawText}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>

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
