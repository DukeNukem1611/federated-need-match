// Incidents index — the federated knowledge base of long-running situations.
// Any NGO can read every incident here; updates from any organization flow
// into a single timeline per incident.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePageAuth } from "@/lib/auth";
import { LiveRefresh } from "@/components/LiveRefresh";
import { LiveEyebrow, ScanLine, HoverShine } from "@/components/section";
import {
  incidentCategoryEmoji,
  incidentCategoryLabel,
  incidentStatusColor,
  incidentStatusDot,
} from "@/lib/format";
import type { IncidentCategory, IncidentStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_ORDER: IncidentStatus[] = ["ACTIVE", "MONITORING", "RESOLVED", "ARCHIVED"];
const CATEGORIES: IncidentCategory[] = [
  "FLOOD", "FIRE", "EARTHQUAKE", "STORM", "OUTBREAK", "ACCIDENT", "CONFLICT", "OTHER",
];
const PAGE_SIZE = 12;

export default async function IncidentsIndex({
  searchParams,
}: {
  searchParams: { status?: string; cat?: string; q?: string; page?: string };
}) {
  await requirePageAuth();
  const filter = (searchParams.status as IncidentStatus | undefined);
  const cat = CATEGORIES.includes(searchParams.cat as IncidentCategory)
    ? (searchParams.cat as IncidentCategory)
    : undefined;
  const q = searchParams.q?.trim() || undefined;
  const page = Math.max(1, Number(searchParams.page) || 1);

  const where: Prisma.IncidentWhereInput = {
    ...(filter ? { status: filter } : {}),
    ...(cat ? { category: cat } : {}),
    ...(q
      ? {
          OR: [
            { title:         { contains: q, mode: "insensitive" } },
            { description:   { contains: q, mode: "insensitive" } },
            { locationLabel: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // Run the filtered list and the unfiltered status counts in parallel.
  // Counts must be unfiltered so the pills always show totals across every
  // status — otherwise picking "Monitoring" would zero out the others.
  const [incidents, filteredCount, statusGroups, totalCount] = await Promise.all([
    prisma.incident.findMany({
      where,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        createdByNgo: { select: { id: true, name: true, slug: true } },
        _count: { select: { updates: true, needs: true } },
      },
    }),
    prisma.incident.count({ where }),
    prisma.incident.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.incident.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  // Filter-preserving link builder (page resets on any filter change).
  const buildHref = (patch: Partial<{ status?: string; cat?: string; q?: string; page?: number }>) => {
    const merged = { status: filter, cat, q, page: undefined as number | undefined, ...patch };
    const params = new URLSearchParams();
    if (merged.status) params.set("status", merged.status);
    if (merged.cat) params.set("cat", merged.cat);
    if (merged.q) params.set("q", merged.q);
    if (merged.page && merged.page > 1) params.set("page", String(merged.page));
    const s = params.toString();
    return s ? `/incidents?${s}` : "/incidents";
  };

  const counts: Record<IncidentStatus, number> = {
    ACTIVE: 0, MONITORING: 0, RESOLVED: 0, ARCHIVED: 0,
  };
  for (const g of statusGroups) counts[g.status] = g._count._all;

  // Distinct contributing NGOs (per incident) — small extra query, but the
  // index page is meant to feel like a situation board.
  const contributorMap = new Map<string, Set<string>>();
  if (incidents.length) {
    const allUpdates = await prisma.incidentUpdate.findMany({
      where: { incidentId: { in: incidents.map(i => i.id) } },
      select: { incidentId: true, ngo: { select: { name: true } } },
    });
    for (const u of allUpdates) {
      const set = contributorMap.get(u.incidentId) ?? new Set<string>();
      set.add(u.ngo.name);
      contributorMap.set(u.incidentId, set);
    }
  }

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
            <Link href="/network" className="btn-ghost">Network</Link>
            <Link href="/" className="btn-ghost">All NGOs</Link>
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-[1440px] px-6 py-10 sm:px-10">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <LiveEyebrow>Knowledge Base</LiveEyebrow>
            <h1 className="heading mt-2 text-3xl font-bold text-on-surface sm:text-5xl">
              Incident Board
            </h1>
            <ScanLine className="mt-3 w-28" />
            <p className="mt-3 max-w-3xl text-sm text-on-surface-variant sm:text-base">
              A shared, append-only log of multi-NGO situations. Anyone arriving
              on scene can read the full timeline before acting — road closures,
              medical alerts, resource drops, and resolutions are all recorded
              by the organizations that posted them.
            </p>
          </div>
          <LiveRefresh intervalMs={15_000} />
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link
            href={buildHref({ status: undefined })}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
              !filter
                ? "border-primary-container/50 bg-primary-container/10 text-primary"
                : "border-black/10 bg-surface-container/50 text-on-surface-variant hover:text-primary"
            }`}
          >
            All ({totalCount})
          </Link>
          {STATUS_ORDER.map(s => (
            <Link
              key={s}
              href={buildHref({ status: s })}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                filter === s
                  ? "border-primary-container/50 bg-primary-container/10 text-primary"
                  : "border-black/10 bg-surface-container/50 text-on-surface-variant hover:text-primary"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${incidentStatusDot[s]}`} />
              {s} ({counts[s]})
            </Link>
          ))}
          <div className="ml-auto">
            <Link href="/incidents/new" className="btn-primary !text-[11px]">
              + File Incident
            </Link>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-2">
          {CATEGORIES.map(c => (
            <Link
              key={c}
              href={buildHref({ cat: cat === c ? undefined : c })}
              title={incidentCategoryLabel[c]}
              className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                cat === c
                  ? "border-primary-container/50 bg-primary-container/10 text-primary"
                  : "border-black/10 bg-surface-container/50 text-on-surface-variant hover:text-primary"
              }`}
            >
              {incidentCategoryEmoji[c]} {incidentCategoryLabel[c]}
            </Link>
          ))}

          {/* Plain GET form — server-rendered search, no client JS needed. */}
          <form method="GET" action="/incidents" className="ml-auto flex items-center gap-2">
            {filter && <input type="hidden" name="status" value={filter} />}
            {cat && <input type="hidden" name="cat" value={cat} />}
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search title, description, location…"
              className="input-field !w-64 !py-1.5 text-xs"
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

        {incidents.length === 0 ? (
          <div className="glass-panel rounded-xl p-10 text-center text-sm text-on-surface-variant">
            {q || cat || filter
              ? "Nothing matches these filters."
              : "No incidents yet. Be the first to file one."}
          </div>
        ) : (
          <ul className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
            {incidents.map(i => {
              const contributors = Array.from(contributorMap.get(i.id) ?? []);
              return (
                <li key={i.id}>
                  <Link
                    href={`/incidents/${i.id}`}
                    className="group glass-card relative block h-full overflow-hidden rounded-xl p-6 transition-all hover:-translate-y-0.5 hover:border-primary-container/50 hover:shadow-glow-cyan"
                  >
                    <div className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-primary-container transition-transform duration-300 group-hover:scale-x-100" />
                    <HoverShine />

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-md border border-black/5 bg-surface-container-low text-xl">
                        {incidentCategoryEmoji[i.category]}
                      </div>
                      <span
                        className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${incidentStatusColor[i.status]}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${incidentStatusDot[i.status]}`} />
                        {i.status}
                      </span>
                    </div>

                    <h3 className="heading mt-4 text-lg font-semibold text-on-surface">
                      {i.title}
                    </h3>
                    <p className="label-caps mt-1 text-on-surface-variant">
                      {incidentCategoryLabel[i.category]}
                    </p>

                    {i.description && (
                      <p className="mt-3 line-clamp-3 text-xs text-on-surface-variant">
                        {i.description}
                      </p>
                    )}

                    <div className="mt-4 flex items-center gap-3 text-[11px] text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <span className="text-primary-container">◎</span>
                        {i.locationLabel}
                      </span>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4 text-xs">
                      <div className="flex gap-4">
                        <Stat label="Updates" value={i._count.updates} />
                        <div className="h-7 w-px bg-black/5" />
                        <Stat label="Needs"   value={i._count.needs}   />
                        <div className="h-7 w-px bg-black/5" />
                        <Stat label="NGOs"    value={Math.max(contributors.length, 1)} />
                      </div>
                      <span className="text-primary-container transition-transform group-hover:translate-x-1">→</span>
                    </div>

                    {contributors.length > 0 && (
                      <p className="mono-data mt-3 truncate text-[10px] uppercase tracking-wider text-on-surface-variant">
                        {contributors.slice(0, 3).join(" · ")}
                        {contributors.length > 3 && ` · +${contributors.length - 3}`}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            {page > 1 ? (
              <Link href={buildHref({ page: page - 1 })} className="btn-ghost !px-4 !py-2 !text-[11px]">
                ← Previous
              </Link>
            ) : (
              <span className="btn-ghost pointer-events-none !px-4 !py-2 !text-[11px] opacity-40">← Previous</span>
            )}
            <span className="mono-data text-xs text-on-surface-variant">
              Page {page} of {totalPages} · {filteredCount} incidents
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
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="heading text-base font-semibold text-on-surface">{value}</p>
      <p className="label-caps mt-0.5">{label}</p>
    </div>
  );
}
