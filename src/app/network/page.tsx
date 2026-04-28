// Federated network view — every shared need across all NGOs, plus a hotspot
// map. This is the page that visually proves the federation is working.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { HotspotMap } from "@/components/HotspotMap";
import { LiveRefresh } from "@/components/LiveRefresh";
import { NeedRow } from "@/components/NeedRow";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const needs = await prisma.reportedNeed.findMany({
    where: { isShared: true },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
    include: {
      ngo: { select: { id: true, name: true } },
      requiredSkills: { include: { skill: true } },
      matches: { orderBy: { createdAt: "desc" } },
    },
  });

  const byNgo = needs.reduce<Record<string, number>>((acc, n) => {
    acc[n.ngo.name] = (acc[n.ngo.name] ?? 0) + 1;
    return acc;
  }, {});

  const criticalCount = needs.filter(n => n.urgency === "CRITICAL").length;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full bg-primary-container/10 blur-[140px]" />

      <nav className="relative z-10 border-b border-white/5 bg-surface/70 backdrop-blur-md">
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
            <p className="label-caps text-surface-tint">Federated Network</p>
            <h1 className="heading mt-2 text-3xl font-bold text-on-surface sm:text-5xl">
              Cross-NGO Signal Board
            </h1>
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
          <HotspotMap needs={needs as any} />
        </section>

        <section>
          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="label-caps text-surface-tint">Incoming</p>
              <h2 className="heading mt-1 text-xl font-semibold text-on-surface">
                Shared Needs
              </h2>
            </div>
            <span className="mono-data rounded-md border border-white/10 bg-surface-container/60 px-3 py-1 text-primary-container">
              {needs.length} active
            </span>
          </div>

          {needs.length === 0 ? (
            <div className="glass-panel rounded-xl p-10 text-center text-sm text-on-surface-variant">
              Nothing shared yet. Open an NGO dashboard and click &ldquo;Share&rdquo;
              on any need to expose it to the federated pool.
            </div>
          ) : (
            <ul className="space-y-3">
              {needs.map(n => (
                <NeedRow key={n.id} need={n as any} />
              ))}
            </ul>
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
    <div className="glass-panel group relative overflow-hidden rounded-xl p-5 transition-all hover:border-primary-container/50">
      <div className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-primary-container transition-transform duration-300 group-hover:scale-x-100" />
      <p className="label-caps">{label}</p>
      <p className="heading mt-3 text-3xl font-semibold text-on-surface">{value}</p>
      <p className={`mono-data mt-2 text-[11px] uppercase tracking-wider ${accent === "danger" ? "text-red-300" : "text-primary-container"}`}>
        {trend}
      </p>
    </div>
  );
}
