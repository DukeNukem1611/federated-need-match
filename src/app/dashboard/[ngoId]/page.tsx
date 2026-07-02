// NGO dashboard — "mission console" layout with a KPI strip, ingest panel,
// needs feed, and volunteer sidebar. Server component reads the NGO + its
// needs + volunteers in parallel, then hands them to client components.
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageAuth } from "@/lib/auth";
import { IngestForm } from "@/components/IngestForm";
import { NeedRow } from "@/components/NeedRow";
import { VolunteerPanel } from "@/components/VolunteerPanel";
import { AddHelperForm } from "@/components/AddHelperForm";
import { NotificationBell } from "@/components/NotificationBell";
import { PushManager } from "@/components/PushManager";
import { AuthMenu } from "@/components/AuthMenu";
import { AvatarUpload } from "@/components/AvatarUpload";
import { InstallButton } from "@/components/InstallButton";
import { CountUp } from "@/components/CountUp";
import { LiveEyebrow, ScanLine, HoverShine } from "@/components/section";
import { withPhotoFlag } from "@/lib/photos";

export const dynamic = "force-dynamic";

const NEED_STATUSES = ["OPEN", "MATCHED", "IN_PROGRESS", "RESOLVED", "CANCELLED"] as const;
type NeedStatusFilter = (typeof NEED_STATUSES)[number];

export default async function NgoDashboard({
  params,
  searchParams,
}: {
  params: { ngoId: string };
  searchParams: { status?: string };
}) {
  // Anyone signed in (or the super-admin) can *view* any NGO's console — the
  // federation is meant to be transparent. But mutating controls (ingest,
  // add/remove volunteers, per-need actions) are limited to this NGO's own
  // members via `isOwnNgo` / `canManage` below.
  const { session } = await requirePageAuth();
  const isOwnNgo = !session || session.ngoId === params.ngoId; // super-admin (no session) sees every NGO as "own"
  const canManage = isOwnNgo && (!session || session.role === "ADMIN"); // own NGO admin, or super-admin

  const ngo = await prisma.nGO.findUnique({ where: { id: params.ngoId } });
  if (!ngo) notFound();

  const [needRows, volunteers, skills, admin] = await Promise.all([
    prisma.reportedNeed.findMany({
      where: { ngoId: params.ngoId },
      orderBy: [{ status: "asc" }, { urgency: "desc" }, { createdAt: "desc" }],
      include: {
        ngo: { select: { id: true, name: true } },
        requiredSkills: { include: { skill: true } },
        matches: {
          orderBy: { createdAt: "desc" },
          include: { volunteer: { select: { id: true, name: true, ngo: { select: { name: true } } } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { ngoId: params.ngoId, role: "VOLUNTEER" },
      include: {
        skills: { include: { skill: true } },
        activeIncident: { select: { id: true, title: true } },
        activeNeed: { select: { id: true, rawText: true } },
        _count: { select: { matches: { where: { status: "COMPLETED" } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.skill.findMany({ orderBy: { name: "asc" } }),
    // Fallback "current user" for the notification bell when viewed by the
    // super-admin (who has no user session): the NGO's own admin.
    prisma.user.findFirst({
      where: { ngoId: params.ngoId, role: "ADMIN" },
      select: { id: true },
    }),
  ]);

  // Photo bytes stay server-side; rows carry a hasPhoto flag instead.
  const needs = needRows.map(withPhotoFlag);

  // Needs-list status filter (?status=OPEN …). KPIs always show full totals.
  const statusFilter = NEED_STATUSES.includes(searchParams.status as NeedStatusFilter)
    ? (searchParams.status as NeedStatusFilter)
    : undefined;
  const visibleNeeds = statusFilter ? needs.filter(n => n.status === statusFilter) : needs;
  const statusCounts = Object.fromEntries(
    NEED_STATUSES.map(s => [s, needs.filter(n => n.status === s).length]),
  ) as Record<NeedStatusFilter, number>;

  // The signed-in user (for the bell + account menu); null for the super-admin.
  const me = session
    ? await prisma.user.findUnique({ where: { id: session.uid }, select: { id: true, name: true } })
    : null;
  const bellUserId = me?.id ?? admin?.id;

  const defaultLat = volunteers[0]?.latitude ?? 12.9716;
  const defaultLng = volunteers[0]?.longitude ?? 77.5946;

  const openCount     = needs.filter(n => n.status === "OPEN").length;
  const matchedCount  = needs.filter(n => n.status === "MATCHED").length;
  const sharedCount   = needs.filter(n => n.isShared).length;
  const criticalCount = needs.filter(n => n.urgency === "CRITICAL" && n.status === "OPEN").length;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -right-20 h-96 w-96 rounded-full bg-primary-container/10 blur-[140px]" />

      <nav className="relative z-50 border-b border-black/5 bg-surface/70 backdrop-blur-md">
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
            <span className="hidden h-6 w-px bg-black/10 sm:block" />
            <Link href="/" className="hidden text-xs uppercase tracking-[0.1em] text-on-surface-variant hover:text-primary sm:inline">
              ← All NGOs
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-md border border-black/10 bg-surface-container-high/60 px-3 py-1.5 sm:flex">
              <span className="label-caps">{isOwnNgo ? "Session" : "Viewing"}</span>
              <span className={`mono-data ${isOwnNgo ? "text-primary-container" : "text-amber-600"}`}>
                {ngo.slug.toUpperCase()}
              </span>
            </div>
            <Link
              href={isOwnNgo ? `/incidents/new?ngoId=${ngo.id}` : "/incidents/new"}
              className="btn-ghost"
            >
              + Incident
            </Link>
            <Link href="/incidents" className="btn-ghost">
              Incidents
            </Link>
            <Link href="/network" className="btn-ghost">
              Network →
            </Link>
            <InstallButton />
            {me && <PushManager />}
            {bellUserId && <NotificationBell userId={bellUserId} />}
            {me && (
              <AuthMenu
                name={me.name}
                role={session!.role}
                home={session!.role === "ADMIN" ? `/dashboard/${session!.ngoId}` : `/user/${session!.uid}`}
              />
            )}
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-[1440px] px-6 py-10 sm:px-10">
        <header className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <LiveEyebrow>Command Center</LiveEyebrow>
            <div className="mt-2 flex items-center gap-4">
              <AvatarUpload
                src={ngo.logoData}
                fallback="◆"
                endpoint={`/api/ngos/${ngo.id}`}
                field="logoData"
                editable={canManage}
                size="lg"
                shape="rounded"
                alt={`${ngo.name} logo`}
              />
              <h1 className="heading text-3xl font-bold text-on-surface sm:text-5xl">
                {ngo.name}
              </h1>
            </div>
            <ScanLine className="mt-2.5 w-28" />
            <p className="mono-data mt-2 text-xs uppercase tracking-widest text-on-surface-variant">
              /{ngo.slug} ·{" "}
              <span className={ngo.sharesPool ? "text-emerald-600" : "text-on-surface-variant"}>
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
            {isOwnNgo ? (
              <IngestForm
                ngoId={ngo.id}
                defaultLat={defaultLat}
                defaultLng={defaultLng}
                mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
              />
            ) : (
              <div className="glass-panel flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.07] p-4 text-sm text-amber-700">
                <span className="text-amber-600">👁</span>
                <span>
                  You&rsquo;re viewing <span className="font-semibold">{ngo.name}</span> in read-only
                  mode. Ingesting reports and managing volunteers is limited to its own members.
                </span>
              </div>
            )}

            <div className="glass-panel rounded-xl p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <LiveEyebrow>Reported Needs</LiveEyebrow>
                  <h2 className="heading mt-1 text-xl font-semibold text-on-surface">
                    Incoming Field Reports
                  </h2>
                  <ScanLine className="mt-2 w-20" />
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/ngos/${ngo.id}/export`}
                    className="btn-ghost !px-3 !py-1.5 !text-[11px]"
                    title="Download this NGO's needs as a CSV"
                  >
                    ⤓ CSV
                  </a>
                  <span className="mono-data rounded-md border border-black/10 bg-surface-container/60 px-3 py-1 text-primary-container">
                    {statusFilter ? `${visibleNeeds.length} of ${needs.length}` : `${needs.length} total`}
                  </span>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-1.5">
                <Link
                  href={`/dashboard/${ngo.id}`}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                    !statusFilter
                      ? "border-primary-container/50 bg-primary-container/10 text-primary"
                      : "border-black/10 bg-surface-container/50 text-on-surface-variant hover:text-primary"
                  }`}
                >
                  All
                </Link>
                {NEED_STATUSES.filter(s => statusCounts[s] > 0 || s === statusFilter).map(s => (
                  <Link
                    key={s}
                    href={statusFilter === s ? `/dashboard/${ngo.id}` : `/dashboard/${ngo.id}?status=${s}`}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                      statusFilter === s
                        ? "border-primary-container/50 bg-primary-container/10 text-primary"
                        : "border-black/10 bg-surface-container/50 text-on-surface-variant hover:text-primary"
                    }`}
                  >
                    {s.replace("_", " ")} ({statusCounts[s]})
                  </Link>
                ))}
              </div>

              {visibleNeeds.length === 0 ? (
                <div className="rounded-md border border-dashed border-black/10 bg-surface-container-low/50 p-10 text-center text-sm text-on-surface-variant">
                  {statusFilter ? `No ${statusFilter.replace("_", " ").toLowerCase()} needs.` : "No needs yet. Ingest one above."}
                </div>
              ) : (
                <ul className="space-y-3">
                  {visibleNeeds.map(n => (
                    <NeedRow key={n.id} need={n as any} viewerNgoId={session?.ngoId} />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <aside className="space-y-gutter">
            {canManage && (
              <AddHelperForm
                ngoId={ngo.id}
                skills={skills}
                defaultLat={defaultLat}
                defaultLng={defaultLng}
              />
            )}
            <VolunteerPanel volunteers={volunteers as any} allSkills={skills} canManage={canManage} />
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
