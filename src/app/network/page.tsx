// Federated network view — every shared need across all NGOs, plus a hotspot
// map. This is the page that visually proves the federation is working.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageAuth } from "@/lib/auth";
import { HotspotMap } from "@/components/HotspotMap";
import { HotspotMapLive } from "@/components/HotspotMapLive";
import { LiveRefresh } from "@/components/LiveRefresh";
import { NeedRow } from "@/components/NeedRow";
import { CountUp } from "@/components/CountUp";
import { LiveEyebrow, ScanLine, HoverShine } from "@/components/section";
import { withPhotoFlag } from "@/lib/photos";
import { categoryEmoji } from "@/lib/format";
import { AnalyticsPanel, type DayPoint } from "@/components/AnalyticsPanel";
import type { NeedCategory, Urgency } from "@prisma/client";

export const dynamic = "force-dynamic";

const URGENCIES: Urgency[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const CATEGORIES: NeedCategory[] = [
  "SUPPLY", "MEDICAL", "SHELTER", "FOOD", "TRANSPORT", "COUNSELING", "OTHER",
];
const PAGE_SIZE = 15;

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: { urgency?: string; cat?: string; q?: string; page?: string };
}) {
  const { session } = await requirePageAuth();
  const needRows = await prisma.reportedNeed.findMany({
    where: { isShared: true },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
    include: {
      ngo: { select: { id: true, name: true } },
      requiredSkills: { include: { skill: true } },
      matches: {
        orderBy: { createdAt: "desc" },
        include: { volunteer: { select: { id: true, name: true, ngo: { select: { name: true } } } } },
      },
    },
  });
  // Keep photo bytes out of the RSC payload (this page live-refreshes).
  const needs = needRows.map(withPhotoFlag);

  // ── Analytics: whole-network numbers (not just the shared pool) ──
  const DAYS = 14;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (DAYS - 1));

  const [recentNeeds, recentMatches, recentResolved, resolvedPairs, firstMatches, matchGroups, catGroups, ngoGroups, ngoNames] =
    await Promise.all([
      prisma.reportedNeed.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.match.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.reportedNeed.findMany({ where: { resolvedAt: { gte: since } }, select: { resolvedAt: true } }),
      // All resolved needs (any age) → time-to-resolution.
      prisma.reportedNeed.findMany({
        where: { resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
      // First match per need → time-to-match.
      prisma.match.findMany({
        orderBy: { createdAt: "asc" },
        distinct: ["needId"],
        select: { createdAt: true, need: { select: { createdAt: true } } },
      }),
      prisma.match.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.reportedNeed.groupBy({ by: ["category"], _count: { _all: true }, orderBy: { _count: { category: "desc" } } }),
      prisma.reportedNeed.groupBy({ by: ["ngoId"], _count: { _all: true }, orderBy: { _count: { ngoId: "desc" } }, take: 6 }),
      prisma.nGO.findMany({ select: { id: true, name: true } }),
    ]);

  const dayKey = (d: Date) => {
    const local = new Date(d);
    local.setHours(0, 0, 0, 0);
    return local.getTime();
  };
  const days: DayPoint[] = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    return {
      key: d.getTime(),
      label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      filed: 0,
      matched: 0,
      resolved: 0,
    };
  }).map(({ key, ...rest }) => {
    return {
      ...rest,
      filed: recentNeeds.filter(n => dayKey(n.createdAt) === key).length,
      matched: recentMatches.filter(m => dayKey(m.createdAt) === key).length,
      resolved: recentResolved.filter(n => n.resolvedAt && dayKey(n.resolvedAt) === key).length,
    };
  });

  const median = (hours: number[]) => {
    const sorted = hours.filter(h => h >= 0).sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  };
  const medianHours = median(
    firstMatches.map(m => (m.createdAt.getTime() - m.need.createdAt.getTime()) / 3_600_000),
  );
  const medianResolutionHours = median(
    resolvedPairs.map(n => (n.resolvedAt!.getTime() - n.createdAt.getTime()) / 3_600_000),
  );

  const matchCount = (s: string) => matchGroups.find(g => g.status === s)?._count._all ?? 0;
  const acceptedCount = matchCount("ACCEPTED") + matchCount("COMPLETED");
  const declinedCount = matchCount("DECLINED");

  const nameOf = new Map(ngoNames.map(n => [n.id, n.name]));
  const byNgoBars = ngoGroups.map(g => ({
    name: nameOf.get(g.ngoId) ?? "Unknown",
    count: g._count._all,
  }));
  const byCategoryBars = catGroups.map(g => ({ name: g.category, count: g._count._all }));

  // KPIs + map always reflect the full shared pool; the list below narrows.
  const byNgo = needs.reduce<Record<string, number>>((acc, n) => {
    acc[n.ngo.name] = (acc[n.ngo.name] ?? 0) + 1;
    return acc;
  }, {});

  const criticalCount = needs.filter(n => n.urgency === "CRITICAL").length;
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  // List filters (searchParams-driven so the page stays a server component).
  const urgency = URGENCIES.includes(searchParams.urgency as Urgency)
    ? (searchParams.urgency as Urgency)
    : undefined;
  const cat = CATEGORIES.includes(searchParams.cat as NeedCategory)
    ? (searchParams.cat as NeedCategory)
    : undefined;
  const q = searchParams.q?.trim().toLowerCase() || undefined;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const filtered = needs.filter(n =>
    (!urgency || n.urgency === urgency) &&
    (!cat || n.category === cat) &&
    (!q ||
      n.rawText.toLowerCase().includes(q) ||
      (n.locationLabel ?? "").toLowerCase().includes(q) ||
      n.ngo.name.toLowerCase().includes(q)),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageNeeds = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const buildHref = (patch: Partial<{ urgency?: string; cat?: string; q?: string; page?: number }>) => {
    const merged = { urgency, cat, q: searchParams.q?.trim() || undefined, page: undefined as number | undefined, ...patch };
    const params = new URLSearchParams();
    if (merged.urgency) params.set("urgency", merged.urgency);
    if (merged.cat) params.set("cat", merged.cat);
    if (merged.q) params.set("q", merged.q);
    if (merged.page && merged.page > 1) params.set("page", String(merged.page));
    const s = params.toString();
    return s ? `/network?${s}` : "/network";
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full bg-primary-container/10 blur-[140px]" />

      <nav className="relative z-10 border-b border-black/5 bg-surface/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-10">
          <Link href="/" className="flex items-center gap-3 text-primary-container hover:text-primary">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-primary-container/15">
              <span className="heading text-lg font-bold">◆</span>
            </div>
            <span className="heading text-lg font-bold uppercase tracking-[0.18em]">
              Federated Relief
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/incidents" className="btn-ghost">Incidents</Link>
            <Link href="/" className="btn-ghost">← All NGOs</Link>
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-[1440px] px-6 py-10 sm:px-10">
        <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <LiveEyebrow>Federated Network</LiveEyebrow>
            <h1 className="heading mt-2 text-3xl font-bold text-on-surface sm:text-5xl">
              Cross-NGO Signal Board
            </h1>
            <ScanLine className="mt-3 w-28" />
            <p className="mt-3 max-w-2xl text-sm text-on-surface-variant sm:text-base">
              Every need opted-in to the federated pool, projected onto a
              unified hotspot view. Shared signals can be picked up by
              volunteers from any organization.
            </p>
          </div>
          <LiveRefresh intervalMs={15_000} />
        </header>

        <div className="mb-10 grid grid-cols-2 gap-gutter md:grid-cols-4">
          <Kpi label="Shared Needs"   value={needs.length}              trend="across network" />
          <Kpi label="Critical"       value={criticalCount}             trend="highest urgency" accent={criticalCount > 0 ? "danger" : "default"} />
          <Kpi label="Contributing"   value={Object.keys(byNgo).length} trend="NGOs" />
          <Kpi label="Top Source"
               value={Object.entries(byNgo).sort((a, b) => b[1] - a[1])[0]?.[1] ?? 0}
               trend={Object.entries(byNgo).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"} />
        </div>

        <section className="mb-10">
          {mapsKey ? (
            <HotspotMapLive needs={needs as any} apiKey={mapsKey} />
          ) : (
            <HotspotMap needs={needs as any} />
          )}
        </section>

        <section className="mb-10">
          <div className="mb-5">
            <LiveEyebrow>Pulse</LiveEyebrow>
            <h2 className="heading mt-1 text-xl font-semibold text-on-surface">
              Network Analytics
            </h2>
            <ScanLine className="mt-2 w-20" />
          </div>
          <AnalyticsPanel
            days={days}
            medianHours={medianHours}
            medianResolutionHours={medianResolutionHours}
            acceptedCount={acceptedCount}
            declinedCount={declinedCount}
            byNgo={byNgoBars}
            byCategory={byCategoryBars}
          />
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <LiveEyebrow>Incoming</LiveEyebrow>
              <h2 className="heading mt-1 text-xl font-semibold text-on-surface">
                Shared Needs
              </h2>
              <ScanLine className="mt-2 w-20" />
            </div>
            <span className="mono-data rounded-md border border-black/10 bg-surface-container/60 px-3 py-1 text-primary-container">
              {filtered.length === needs.length
                ? `${needs.length} active`
                : `${filtered.length} of ${needs.length}`}
            </span>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            {URGENCIES.map(u => (
              <Link
                key={u}
                href={buildHref({ urgency: urgency === u ? undefined : u })}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                  urgency === u
                    ? "border-primary-container/50 bg-primary-container/10 text-primary"
                    : "border-black/10 bg-surface-container/50 text-on-surface-variant hover:text-primary"
                }`}
              >
                {u}
              </Link>
            ))}
            <span className="h-4 w-px bg-black/10" />
            {CATEGORIES.map(c => (
              <Link
                key={c}
                href={buildHref({ cat: cat === c ? undefined : c })}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  cat === c
                    ? "border-primary-container/50 bg-primary-container/10 text-primary"
                    : "border-black/10 bg-surface-container/50 text-on-surface-variant hover:text-primary"
                }`}
              >
                {categoryEmoji[c]} {c}
              </Link>
            ))}

            <form method="GET" action="/network" className="ml-auto flex items-center gap-2">
              {urgency && <input type="hidden" name="urgency" value={urgency} />}
              {cat && <input type="hidden" name="cat" value={cat} />}
              <input
                type="search"
                name="q"
                defaultValue={searchParams.q ?? ""}
                placeholder="Search needs, places, NGOs…"
                className="input-field !w-56 !py-1.5 text-xs"
              />
              <button type="submit" className="btn-ghost !px-3 !py-1.5 !text-[11px]">
                Search
              </button>
              {q && (
                <Link href={buildHref({ q: undefined })} className="text-[11px] text-on-surface-variant hover:text-on-surface">
                  Clear
                </Link>
              )}
            </form>
          </div>

          {pageNeeds.length === 0 ? (
            <div className="glass-panel rounded-xl p-10 text-center text-sm text-on-surface-variant">
              {needs.length === 0
                ? "Nothing shared yet. Open an NGO dashboard and click “Share” on any need to expose it to the federated pool."
                : "Nothing matches these filters."}
            </div>
          ) : (
            <ul className="space-y-3">
              {pageNeeds.map(n => (
                <NeedRow key={n.id} need={n as any} viewerNgoId={session?.ngoId} />
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              {page > 1 ? (
                <Link href={buildHref({ page: page - 1 })} className="btn-ghost !px-4 !py-2 !text-[11px]">
                  ← Previous
                </Link>
              ) : (
                <span className="btn-ghost pointer-events-none !px-4 !py-2 !text-[11px] opacity-40">← Previous</span>
              )}
              <span className="mono-data text-xs text-on-surface-variant">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={buildHref({ page: page + 1 })} className="btn-ghost !px-4 !py-2 !text-[11px]">
                  Next →
                </Link>
              ) : (
                <span className="btn-ghost pointer-events-none !px-4 !py-2 !text-[11px] opacity-40">Next →</span>
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function Kpi({
  label,
  value,
  trend,
  accent = "default",
}: {
  label: string;
  value: number;
  trend: string;
  accent?: "default" | "danger";
}) {
  return (
    <div className="glass-panel group relative overflow-hidden rounded-xl p-5 transition-all hover:-translate-y-0.5 hover:border-primary-container/50 hover:shadow-glow-cyan">
      <div className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-primary-container transition-transform duration-300 group-hover:scale-x-100" />
      <HoverShine />
      <p className="label-caps">{label}</p>
      <CountUp value={value} className="heading mt-3 block text-3xl font-semibold text-on-surface" />
      <p className={`mono-data mt-2 text-[11px] uppercase tracking-wider ${accent === "danger" ? "text-red-600" : "text-primary-container"}`}>
        {trend}
      </p>
    </div>
  );
}
