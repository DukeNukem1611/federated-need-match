// Platform-admin console. The super-admin registers NGOs here and sees a
// roster of every organization on the platform with roll-up counts.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AddNgoForm } from "./AddNgoForm";
import { LogoutButton } from "./LogoutButton";
import { RemoveNgoButton } from "./RemoveNgoButton";
import { CountUp } from "@/components/CountUp";
import { LiveEyebrow, ScanLine, HoverShine } from "@/components/section";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [ngos, userCount, incidentCount] = await Promise.all([
    prisma.nGO.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        // Pull roles so the roster can distinguish admins from helpers — a
        // freshly created NGO has its admin but no volunteers yet.
        users: { select: { role: true } },
        _count: { select: { reportedNeeds: true, createdIncidents: true } },
      },
    }),
    prisma.user.count(),
    prisma.incident.count(),
  ]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full bg-primary-container/10 blur-[140px]" />

      <nav className="relative z-10 border-b border-black/5 bg-surface/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 sm:px-10">
          <Link href="/" className="flex items-center gap-3 text-primary-container hover:text-primary">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-primary-container/15">
              <span className="heading text-lg font-bold">◆</span>
            </div>
            <span className="heading text-lg font-bold uppercase tracking-[0.18em]">
              Federated Relief
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fuchsia-700">
              Platform Admin
            </span>
            <Link href="/" className="btn-ghost">← Home</Link>
            <LogoutButton />
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-[1280px] px-6 py-10 sm:px-10">
        <header className="mb-10">
          <LiveEyebrow>Administration</LiveEyebrow>
          <h1 className="heading mt-2 text-3xl font-bold text-on-surface sm:text-5xl">
            Platform Console
          </h1>
          <ScanLine className="mt-3 w-28" />
          <p className="mt-3 max-w-2xl text-sm text-on-surface-variant sm:text-base">
            Register organizations onto the federated network. Each NGO can
            then add its own helpers and file incidents.
          </p>
        </header>

        <div className="mb-10 grid grid-cols-3 gap-gutter">
          <Kpi label="NGOs"      value={ngos.length} />
          <Kpi label="Users"     value={userCount} />
          <Kpi label="Incidents" value={incidentCount} />
        </div>

        <div className="grid gap-gutter lg:grid-cols-2">
          <AddNgoForm />

          <div className="glass-panel rounded-xl p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="label-caps text-surface-tint">Roster</p>
                <h2 className="heading mt-1 text-xl font-semibold text-on-surface">
                  Registered NGOs
                </h2>
              </div>
              <span className="mono-data rounded-md border border-black/10 bg-surface-container/60 px-3 py-1 text-primary-container">
                {ngos.length} total
              </span>
            </div>

            {ngos.length === 0 ? (
              <p className="rounded-md border border-dashed border-black/10 p-8 text-center text-sm text-on-surface-variant">
                No NGOs yet. Register the first one.
              </p>
            ) : (
              <ul className="space-y-3">
                {ngos.map(ngo => {
                  const admins = ngo.users.filter(u => u.role === "ADMIN").length;
                  const helpers = ngo.users.filter(u => u.role === "VOLUNTEER").length;
                  return (
                    <li
                      key={ngo.id}
                      className="group flex items-center justify-between gap-3 rounded-lg border border-black/5 bg-surface-container-low/50 px-4 py-3 transition-colors hover:border-primary-container/40"
                    >
                      <Link href={`/dashboard/${ngo.id}`} className="min-w-0 flex-1">
                        <p className="font-medium text-on-surface">{ngo.name}</p>
                        <p className="mono-data text-xs uppercase tracking-widest text-on-surface-variant">
                          /{ngo.slug} · {ngo.sharesPool ? "shares pool" : "private"}
                        </p>
                      </Link>
                      <span className="mono-data hidden text-[11px] text-on-surface-variant sm:inline">
                        {helpers} helper{helpers === 1 ? "" : "s"} · {admins} admin
                        {admins === 1 ? "" : "s"} · {ngo._count.createdIncidents} incidents
                      </span>
                      <RemoveNgoButton ngoId={ngo.id} ngoName={ngo.name} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-panel group relative overflow-hidden rounded-xl p-5 transition-all hover:-translate-y-0.5 hover:border-primary-container/40 hover:shadow-glow-cyan">
      <HoverShine />
      <p className="label-caps">{label}</p>
      <CountUp value={value} className="heading mt-3 block text-3xl font-semibold text-on-surface" />
    </div>
  );
}
