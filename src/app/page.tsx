// Home page — entry into the federated relief command center. Surfaces the
// active incident knowledge base front-and-center, then the NGO picker
// below. Server component reads everything straight from Prisma.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  incidentCategoryEmoji,
  incidentCategoryLabel,
  incidentStatusColor,
  incidentStatusDot,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [ngos, activeIncidents, totalIncidentCount] = await Promise.all([
    prisma.nGO.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true, reportedNeeds: true } } },
    }),
    prisma.incident.findMany({
      where: { status: { in: ["ACTIVE", "MONITORING"] } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 3,
      include: {
        createdByNgo: { select: { name: true } },
        _count: { select: { updates: true, needs: true } },
      },
    }),
    prisma.incident.count(),
  ]);

  const totalNgos = ngos.length;
  const totalVolunteers = ngos.reduce((a, n) => a + n._count.users, 0);
  const totalNeeds = ngos.reduce((a, n) => a + n._count.reportedNeeds, 0);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 hero-gradient" />
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary-container/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-surface-tint/10 blur-[120px]" />

      <nav className="relative z-10 border-b border-white/5 bg-surface/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 sm:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-primary-container/15 text-primary-container">
              <span className="heading text-lg font-bold">◆</span>
            </div>
            <div className="heading text-lg font-bold uppercase tracking-[0.18em] text-primary-container">
              Federated Relief
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/incidents" className="btn-ghost">
              Incident Board
            </Link>
            <Link href="/network" className="btn-ghost">
              Network View →
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-[1280px] px-6 pb-8 pt-20 sm:px-10 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-surface-container-high/60 px-3 py-1">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-primary-container" />
            <span className="label-caps text-on-surface-variant">
              System Status: Operational
            </span>
          </div>
          <h1 className="heading text-glow mb-5 text-4xl font-bold leading-[1.05] tracking-tight text-on-surface sm:text-6xl">
            Route Every Need to the <br className="hidden sm:block" />
            <span className="text-surface-tint">Right Volunteer.</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-on-surface-variant sm:text-lg">
            A command center for multi-NGO coordination. Ingest unstructured
            field reports, visualize urgency hotspots, and share volunteers
            across organizations when your own pool can&rsquo;t cover a need.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl grid-cols-2 gap-gutter sm:grid-cols-4">
          <StatCard label="Incidents Logged"  value={totalIncidentCount} icon="◆" />
          <StatCard label="Connected NGOs"    value={totalNgos}          icon="◈" />
          <StatCard label="Volunteer Pool"    value={totalVolunteers}    icon="◉" />
          <StatCard label="Reported Needs"    value={totalNeeds}         icon="✦" />
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-[1280px] px-6 pb-16 sm:px-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="label-caps text-surface-tint">Active Situations</p>
            <h2 className="heading mt-2 text-2xl font-semibold text-on-surface sm:text-3xl">
              Live Incident Board
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
              Multi-NGO timelines: hazards, needs, resources, and resolutions
              logged by every organization on scene.
            </p>
          </div>
          <Link
            href="/incidents"
            className="hidden text-sm font-medium text-primary hover:text-primary-container sm:inline"
          >
            View all incidents →
          </Link>
        </div>

        {activeIncidents.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center text-sm text-on-surface-variant">
            No active incidents.{" "}
            <Link href="/incidents/new" className="text-primary hover:underline">
              File the first one →
            </Link>
          </div>
        ) : (
          <ul className="grid gap-gutter md:grid-cols-3">
            {activeIncidents.map(i => (
              <li key={i.id}>
                <Link
                  href={`/incidents/${i.id}`}
                  className="group glass-card relative block h-full overflow-hidden rounded-xl p-5 transition-all hover:border-primary-container/50 hover:shadow-glow-cyan"
                >
                  <div className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-primary-container transition-transform duration-300 group-hover:scale-x-100" />

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-white/5 bg-surface-container-low text-xl">
                      {incidentCategoryEmoji[i.category]}
                    </div>
                    <span
                      className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${incidentStatusColor[i.status]}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${incidentStatusDot[i.status]}`} />
                      {i.status}
                    </span>
                  </div>

                  <h3 className="heading mt-3 text-base font-semibold text-on-surface">
                    {i.title}
                  </h3>
                  <p className="label-caps mt-1 text-on-surface-variant">
                    {incidentCategoryLabel[i.category]}
                  </p>

                  <p className="mt-3 truncate text-xs text-on-surface-variant">
                    <span className="text-primary-container">◎</span> {i.locationLabel}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-[11px] text-on-surface-variant">
                    <span className="mono-data">
                      {i._count.updates} updates · {i._count.needs} needs
                    </span>
                    <span className="text-primary-container transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="relative z-10 mx-auto max-w-[1280px] px-6 pb-24 sm:px-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="label-caps text-surface-tint">Mission Control</p>
            <h2 className="heading mt-2 text-2xl font-semibold text-on-surface sm:text-3xl">
              Select an Organization
            </h2>
          </div>
          <Link
            href="/network"
            className="hidden text-sm font-medium text-primary hover:text-primary-container sm:inline"
          >
            View federated network →
          </Link>
        </div>

        {ngos.length === 0 ? (
          <p className="glass-card rounded-xl p-10 text-center text-on-surface-variant">
            No NGOs yet. Run <code className="mono-data text-primary">npm run db:seed</code> to load demo data.
          </p>
        ) : (
          <ul className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
            {ngos.map(ngo => (
              <li key={ngo.id}>
                <Link
                  href={`/dashboard/${ngo.id}`}
                  className="group glass-card relative block overflow-hidden rounded-xl p-6 transition-all hover:border-primary-container/50 hover:shadow-glow-cyan"
                >
                  <div className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-primary-container transition-transform duration-300 group-hover:scale-x-100" />

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-container/10 text-primary-container">
                      <span className="heading text-lg">◈</span>
                    </div>
                    <span
                      className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${
                        ngo.sharesPool
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                          : "border-white/10 bg-white/5 text-on-surface-variant"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          ngo.sharesPool ? "animate-pulse-dot bg-emerald-300" : "bg-slate-400"
                        }`}
                      />
                      {ngo.sharesPool ? "Shares Pool" : "Private"}
                    </span>
                  </div>

                  <h3 className="heading mt-5 text-xl font-semibold text-on-surface">
                    {ngo.name}
                  </h3>
                  <p className="mono-data mt-1 text-xs uppercase tracking-widest text-on-surface-variant">
                    /{ngo.slug}
                  </p>

                  <div className="mt-6 flex gap-4 border-t border-white/5 pt-4 text-sm">
                    <Stat label="Members" value={ngo._count.users} />
                    <div className="h-8 w-px bg-white/5" />
                    <Stat label="Needs"   value={ngo._count.reportedNeeds} />
                  </div>

                  <div className="mt-6 flex items-center justify-between text-xs">
                    <span className="label-caps text-on-surface-variant group-hover:text-primary">
                      Open Dashboard
                    </span>
                    <span className="text-primary-container transition-transform group-hover:translate-x-1">
                      →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-start justify-between">
        <span className="label-caps">{label}</span>
        <span className="mono-data text-primary-container">{icon}</span>
      </div>
      <p className="heading mt-3 text-3xl font-semibold text-on-surface">
        {value}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1">
      <p className="heading text-xl font-semibold text-on-surface">{value}</p>
      <p className="label-caps mt-0.5">{label}</p>
    </div>
  );
}
