// Network analytics — server component, inline SVG, no chart library.
// Forms per the data's job: two-series line (demand vs response over time),
// stat tiles for the headline numbers, single-hue horizontal bars for
// magnitude rankings (identity is carried by labels, not colors).
//
// Palette (validated for CVD + contrast on the light surface):
//   #0891b2 teal   = Matched  (response, brand accent)
//   #d97706 amber  = Filed    (demand)
//   #7c3aed violet = Resolved (outcome)

const TEAL = "#0891b2";
const AMBER = "#d97706";
const VIOLET = "#7c3aed";

export type DayPoint = { label: string; filed: number; matched: number; resolved: number };

export function AnalyticsPanel({
  days,
  medianHours,
  medianResolutionHours,
  acceptedCount,
  declinedCount,
  byNgo,
  byCategory,
}: {
  days: DayPoint[];
  medianHours: number | null;
  medianResolutionHours: number | null;
  acceptedCount: number;
  declinedCount: number;
  byNgo: { name: string; count: number }[];
  byCategory: { name: string; count: number }[];
}) {
  const responded = acceptedCount + declinedCount;
  const acceptRate = responded > 0 ? Math.round((acceptedCount / responded) * 100) : null;

  return (
    <div className="grid gap-gutter lg:grid-cols-3">
      {/* ── Demand vs response, last 14 days ── */}
      <div className="glass-panel rounded-xl p-6 lg:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="label-caps text-surface-tint">Last 14 days</p>
            <h3 className="heading mt-1 text-lg font-semibold text-on-surface">
              Needs filed · matched · resolved
            </h3>
          </div>
          {/* Legend — always present for multiple series */}
          <div className="flex items-center gap-4 text-[11px] text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: AMBER }} />
              Filed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: TEAL }} />
              Matched
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: VIOLET }} />
              Resolved
            </span>
          </div>
        </div>
        <TrendChart days={days} />
      </div>

      {/* ── Headline numbers ── */}
      <div className="flex flex-col gap-gutter">
        <div className="glass-panel flex-1 rounded-xl p-6">
          <p className="label-caps text-surface-tint">Median time to match</p>
          <p className="heading mt-2 text-3xl font-semibold text-on-surface">
            {medianHours == null ? "—" : formatHours(medianHours)}
          </p>
          <p className="mt-1 text-[11px] text-on-surface-variant">
            from a need being filed to its first volunteer match
          </p>
        </div>
        <div className="glass-panel flex-1 rounded-xl p-6">
          <p className="label-caps text-surface-tint">Median time to resolution</p>
          <p className="heading mt-2 text-3xl font-semibold text-on-surface">
            {medianResolutionHours == null ? "—" : formatHours(medianResolutionHours)}
          </p>
          <p className="mt-1 text-[11px] text-on-surface-variant">
            from filed to closed out
          </p>
        </div>
        <div className="glass-panel flex-1 rounded-xl p-6">
          <p className="label-caps text-surface-tint">Assignment acceptance</p>
          <p className="heading mt-2 text-3xl font-semibold text-on-surface">
            {acceptRate == null ? "—" : `${acceptRate}%`}
          </p>
          <p className="mt-1 text-[11px] text-on-surface-variant">
            {responded > 0
              ? `${acceptedCount} accepted · ${declinedCount} declined`
              : "no volunteer responses yet"}
          </p>
        </div>
      </div>

      {/* ── Magnitude rankings (single hue; labels carry identity) ── */}
      <BarPanel eyebrow="Contribution" title="Needs filed per NGO" rows={byNgo} />
      <BarPanel eyebrow="Breakdown" title="Needs by category" rows={byCategory} />

      <div className="glass-panel rounded-xl p-6">
        <p className="label-caps text-surface-tint">Reading this</p>
        <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
          The gap between the amber and teal lines is unmet demand. A rising
          median time-to-match or a falling acceptance rate is the earliest
          signal that the network needs more volunteers — before any need
          visibly goes unanswered.
        </p>
      </div>
    </div>
  );
}

// ── Two-series line chart (inline SVG) ──────────────────────────────
const W = 560;
const H = 170;
const PAD = { top: 14, right: 14, bottom: 22, left: 30 };

function TrendChart({ days }: { days: DayPoint[] }) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const rawMax = Math.max(1, ...days.map(d => Math.max(d.filed, d.matched, d.resolved)));
  const yMax = niceCeil(rawMax);

  const x = (i: number) => PAD.left + (days.length > 1 ? (i / (days.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;
  const pts = (key: "filed" | "matched" | "resolved") =>
    days.map((d, i) => `${x(i)},${y(d[key])}`).join(" ");

  const gridVals = [0, Math.round(yMax / 2), yMax];
  const last = days[days.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img" aria-label="Needs filed, matched, and resolved per day, last 14 days">
      {/* recessive hairline grid + clean ticks */}
      {gridVals.map(v => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="rgba(21,33,46,0.08)" strokeWidth="1" />
          <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#56687a">{v}</text>
        </g>
      ))}
      {/* sparse x labels: first, middle, last */}
      {[0, Math.floor((days.length - 1) / 2), days.length - 1].map(i => (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#56687a">
          {days[i]?.label}
        </text>
      ))}

      {/* 2px round-joined lines */}
      <polyline points={pts("filed")} fill="none" stroke={AMBER} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts("matched")} fill="none" stroke={TEAL} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={pts("resolved")} fill="none" stroke={VIOLET} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* end markers: ≥8px with a 2px surface ring */}
      <circle cx={x(days.length - 1)} cy={y(last.filed)} r="4" fill={AMBER} stroke="#f5f8fc" strokeWidth="2" />
      <circle cx={x(days.length - 1)} cy={y(last.matched)} r="4" fill={TEAL} stroke="#f5f8fc" strokeWidth="2" />
      <circle cx={x(days.length - 1)} cy={y(last.resolved)} r="4" fill={VIOLET} stroke="#f5f8fc" strokeWidth="2" />

      {/* native hover tooltips on generous hit targets */}
      {days.map((d, i) => (
        <g key={i}>
          <rect
            x={x(i) - innerW / days.length / 2}
            y={PAD.top}
            width={innerW / days.length}
            height={innerH}
            fill="transparent"
          >
            <title>{`${d.label} — filed ${d.filed} · matched ${d.matched} · resolved ${d.resolved}`}</title>
          </rect>
        </g>
      ))}
    </svg>
  );
}

// ── Single-hue horizontal bars (HTML marks) ─────────────────────────
function BarPanel({
  eyebrow,
  title,
  rows,
}: {
  eyebrow: string;
  title: string;
  rows: { name: string; count: number }[];
}) {
  const max = Math.max(1, ...rows.map(r => r.count));
  return (
    <div className="glass-panel rounded-xl p-6">
      <p className="label-caps text-surface-tint">{eyebrow}</p>
      <h3 className="heading mt-1 text-lg font-semibold text-on-surface">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-xs text-on-surface-variant">No data yet.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map(r => (
            <li key={r.name} className="flex items-center gap-3" title={`${r.name}: ${r.count}`}>
              <span className="w-24 shrink-0 truncate text-[11px] text-on-surface-variant">{r.name}</span>
              <span className="relative h-4 flex-1">
                <span
                  className="absolute inset-y-0 left-0 rounded-r-[4px]"
                  style={{ width: `${(r.count / max) * 100}%`, background: TEAL, minWidth: r.count > 0 ? 3 : 0 }}
                />
              </span>
              <span className="mono-data w-7 shrink-0 text-right text-[11px] text-on-surface">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────
function niceCeil(v: number): number {
  if (v <= 5) return 5;
  if (v <= 10) return 10;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)}h`;
  return `${(h / 24).toFixed(1)}d`;
}
