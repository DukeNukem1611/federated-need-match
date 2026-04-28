// NGO dashboard — "mission console" layout with a KPI strip, ingest panel,
// needs feed, and volunteer sidebar. Server component reads the NGO + its
// needs + volunteers in parallel, then hands them to client components.
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { IngestForm } from "@/components/IngestForm";
import { NeedRow } from "@/components/NeedRow";
import { VolunteerPanel } from "@/components/VolunteerPanel";

export const dynamic = "force-dynamic";

export default async function NgoDashboard({
  params,
}: {
  params: { ngoId: string };
}) {
  const ngo = await prisma.nGO.findUnique({ where: { id: params.ngoId } });
  if (!ngo) notFound();

  const [needs, volunteers] = await Promise.all([
    prisma.reportedNeed.findMany({
      where: { ngoId: params.ngoId },
      orderBy: [{ status: "asc" }, { urgency: "desc" }, { createdAt: "desc" }],
      include: {
        ngo: { select: { id: true, name: true } },
        requiredSkills: { include: { skill: true } },
        matches: { orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.user.findMany({
      where: { ngoId: params.ngoId, role: "VOLUNTEER" },
      include: { skills: { include: { skill: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const defaultLat = volunteers[0]?.latitude ?? 12.9716;
  const defaultLng = volunteers[0]?.longitude ?? 77.5946;

  const openCount     = needs.filter(n => n.status === "OPEN").length;
  const matchedCount  = needs.filter(n => n.status === "MATCHED").length;
  const sharedCount   = needs.filter(n => n.isShared).length;
  const criticalCount = needs.filter(n => n.urgency === "CRITICAL" && n.status === "OPEN").length;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -right-20 h-96 w-96 rounded-full bg-primary-container/10 blur-[140px]" />

      <nav className="relative z-10 border-b border-white/5 bg-surface/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-10">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-3 text-primary-container hover:text-primary"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded bg-primary-container/15">
                <span className="heading text-lg font-bold">◆</span>
              </div>
              <span className="heading text-lg font-bold uppercase tracking-[0.18em]">
                Federated Relief
              </span>
            </Link>
            <span className="hidden h-6 w-px bg-white/10 sm:block" />
            <Link href="/" className="hidden text-xs uppercase tracking-[0.1em] text-on-surface-variant hover:text-primary sm:inline">
              ← All NGOs
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-md border border-white/10 bg-surface-container-high/60 px-3 py-1.5 sm:flex">
              <span className="label-caps">Session</span>
              <span className="mono-data text-primary-container">
                {ngo.slug.toUpperCase()}
              </span>
            </div>
            <Link href="/incidents" className="btn-ghost">
              Incidents
            </Link>
            <Link href="/network" className="btn-ghost">
              Network →
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-[1440px] px-6 py-10 sm:px-10">
        <header className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="label-caps text-surface-tint">Command Center</p>
            <h1 className="heading mt-2 text-3xl font-bold text-on-surface sm:text-5xl">
              {ngo.name}
            </h1>
            <p className="mono-data mt-2 text-xs uppercase tracking-widest text-on-surface-variant">
              /{ngo.slug} ·{" "}
              <span className={ngo.sharesPool ? "text-emerald-300" : "text-on-surface-variant"}>
                {ngo.sharesPool ? "Shares federated pool" : "Private pool"}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass-panel flex items-center gap-3 rounded-md px-4 py-2">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-primary-container" />
              <span className="label-caps">Live Feed</span>
            </div>
          </div>
        </header>

        <div className="mb-10 grid grid-cols-2 gap-gutter md:grid-cols-4">
          <KpiCard label="Total Needs"   value={needs.length}  trend="All reports" />
          <KpiCard label="Open"          value={openCount}     trend={`${criticalCount} critical`} accent={criticalCount > 0 ? "danger" : "default"} />
          <KpiCard label="Matched"       value={matchedCount}  trend="Volunteer assigned" />
          <KpiCard label="Shared"        value={sharedCount}   trend="To federated pool" />
        </div>

        <div className="grid gap-gutter lg:grid-cols-3">
          <section className="space-y-gutter lg:col-span-2">
            <IngestForm
              ngoId={ngo.id}
              defaultLat={defaultLat}
              defaultLng={defaultLng}
            />

            <div className="glass-panel rounded-xl p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="label-caps text-surface-tint">Reported Needs</p>
                  <h2 className="heading mt-1 text-xl font-semibold text-on-surface">
                    Incoming Field Reports
                  </h2>
                </div>
                <span className="mono-data rounded-md border border-white/10 bg-surface-container/60 px-3 py-1 text-primary-container">
                  {needs.length} total
                </span>
              </div>

              {needs.length === 0 ? (
                <div className="rounded-md border border-dashed border-white/10 bg-surface-container-low/50 p-10 text-center text-sm text-on-surface-variant">
                  No needs yet. Ingest one above.
                </div>
              ) : (
                <ul className="space-y-3">
                  {needs.map(n => (
                    <NeedRow key={n.id} need={n as any} viewerNgoId={ngo.id} />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <aside className="space-y-gutter">
            <VolunteerPanel volunteers={volunteers as any} />
          </aside>
        </div>
      </section>
    </main>
  );
}

function KpiCard({
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
