// Incident detail — the cross-NGO timeline. Any organization can read the
// full history before acting and append their own update. Linked
// ReportedNeeds are shown alongside so the existing matcher still works.
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageAuth } from "@/lib/auth";
import { CountUp } from "@/components/CountUp";
import { LiveEyebrow } from "@/components/section";
import { RemoveIncidentButton } from "@/components/RemoveIncidentButton";
import { AttachedPhoto } from "@/components/AttachedPhoto";
import { withPhotoFlag } from "@/lib/photos";
import { IncidentStatusChanger } from "@/components/IncidentStatusChanger";
import { IncidentUpdateForm } from "@/components/IncidentUpdateForm";
import { IncidentNeedForm } from "@/components/IncidentNeedForm";
import { LiveRefresh } from "@/components/LiveRefresh";
import { NeedRow } from "@/components/NeedRow";
import {
  incidentCategoryEmoji,
  incidentCategoryLabel,
  updateKindStyle,
} from "@/lib/format";

export const dynamic = "force-dynamic";

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export default async function IncidentDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ngo?: string };
}) {
  const { session, superAdmin } = await requirePageAuth();
  const [incident, allNgos] = await Promise.all([
    prisma.incident.findUnique({
      where: { id: params.id },
      include: {
        createdByNgo: { select: { id: true, name: true, slug: true } },
        updates: {
          orderBy: { createdAt: "desc" },
          include: {
            ngo:    { select: { id: true, name: true, slug: true } },
            author: { select: { id: true, name: true } },
          },
        },
        needs: {
          orderBy: { createdAt: "desc" },
          include: {
            ngo: { select: { id: true, name: true } },
            requiredSkills: { include: { skill: true } },
            matches: {
              orderBy: { createdAt: "desc" },
              include: { volunteer: { select: { id: true, name: true, ngo: { select: { name: true } } } } },
            },
          },
        },
      },
    }),
    prisma.nGO.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!incident) notFound();

  // Photo bytes stay server-side (this page live-refreshes every 10s); the
  // browser fetches them once from the cacheable photo endpoints.
  const updates = incident.updates.map(withPhotoFlag);
  const needs = incident.needs.map(withPhotoFlag);

  // Members always act as their own NGO — no impersonation dropdowns. The
  // super-admin has no NGO of their own, so they keep the full list to act
  // on behalf of one.
  const postNgos = session ? allNgos.filter(n => n.id === session.ngoId) : allNgos;

  const contributors = Array.from(new Set(updates.map(u => u.ngo.name)));
  const startedAgo = timeAgo(incident.startedAt);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -right-20 h-96 w-96 rounded-full bg-primary-container/10 blur-[140px]" />

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
            <Link href="/incidents" className="btn-ghost">← All Incidents</Link>
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-[1440px] px-6 py-10 sm:px-10">
        <header className="glass-panel relative z-20 rounded-xl p-6 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary-container/0 via-primary-container/60 to-primary-container/0" />

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-black/10 bg-surface-container-low text-3xl">
                {incidentCategoryEmoji[incident.category]}
              </div>
              <div className="min-w-0">
                <LiveEyebrow>
                  {incidentCategoryLabel[incident.category]} · started {startedAgo}
                </LiveEyebrow>
                <h1 className="heading mt-1 text-2xl font-bold text-on-surface sm:text-4xl">
                  {incident.title}
                </h1>
                <p className="mt-2 text-sm text-on-surface-variant">
                  <span className="text-primary-container">◎</span>{" "}
                  {incident.locationLabel}{" "}
                  <span className="mono-data text-[11px] text-on-surface-variant">
                    ({incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)} · {incident.radiusKm} km radius)
                  </span>
                </p>
                {incident.description && (
                  <p className="mt-3 max-w-3xl text-sm text-on-surface-variant">
                    {incident.description}
                  </p>
                )}
                
                <div className="mt-5 h-[200px] w-full max-w-3xl overflow-hidden rounded-xl border border-black/10 bg-surface-container-low opacity-90 transition-opacity hover:opacity-100 sm:h-[280px]">
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://maps.google.com/maps?q=${incident.latitude},${incident.longitude}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                  />
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
              <IncidentStatusChanger
                incidentId={incident.id}
                currentStatus={incident.status}
                ngos={postNgos}
                defaultNgoId={searchParams.ngo}
              />
              <p className="label-caps text-on-surface-variant">
                Filed by{" "}
                <span className="text-on-surface">{incident.createdByNgo.name}</span>
              </p>
              {superAdmin && <RemoveIncidentButton incidentId={incident.id} />}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-black/5 pt-5 sm:grid-cols-4">
            <Stat label="Updates"      value={updates.length} />
            <Stat label="Linked Needs" value={needs.length}    />
            <Stat label="NGOs On Site" value={Math.max(contributors.length, 1)} />
            <Stat
              label="Last Update"
              valueText={updates[0] ? timeAgo(updates[0].createdAt) : "—"}
            />
          </div>

          {contributors.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="label-caps">Contributors</span>
              {contributors.map(c => (
                <span
                  key={c}
                  className="rounded-full border border-primary-container/30 bg-primary-container/10 px-2.5 py-0.5 text-[11px] text-primary"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="mt-10 grid gap-gutter lg:grid-cols-3">
          <section className="space-y-gutter lg:col-span-2">
            <IncidentUpdateForm
              incidentId={incident.id}
              ngos={postNgos}
              defaultNgoId={searchParams.ngo}
            />

            <div className="glass-panel rounded-xl p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="label-caps text-surface-tint">Field Log</p>
                  <h2 className="heading mt-1 text-xl font-semibold text-on-surface">
                    Timeline ({updates.length})
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="mono-data text-[11px] text-on-surface-variant">
                    Newest First
                  </span>
                  <LiveRefresh intervalMs={10_000} />
                </div>
              </div>

              {updates.length === 0 ? (
                <div className="rounded-md border border-dashed border-black/10 bg-surface-container-low/50 p-10 text-center text-sm text-on-surface-variant">
                  No updates yet — be the first to post one above.
                </div>
              ) : (
                <ol className="relative space-y-5 pl-6">
                  <span className="absolute inset-y-2 left-[7px] w-px bg-gradient-to-b from-primary-container/40 via-black/10 to-transparent" />
                  {updates.map(u => {
                    const s = updateKindStyle[u.kind];
                    return (
                      <li key={u.id} className="relative">
                        <span
                          className={`absolute -left-[19px] top-1.5 h-3 w-3 rounded-full ring-2 ring-surface ${s.dot}`}
                        />
                        <div className="rounded-md border border-black/5 bg-surface-container/60 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${s.chip}`}
                            >
                              <span>{s.icon}</span>
                              {s.label}
                            </span>
                            <span className="text-xs font-medium text-on-surface">
                              {u.ngo.name}
                            </span>
                            {u.author && (
                              <span className="text-[11px] text-on-surface-variant">
                                · {u.author.name}
                              </span>
                            )}
                            <span className="ml-auto mono-data text-[10px] uppercase tracking-wider text-on-surface-variant">
                              {timeAgo(u.createdAt)}
                            </span>
                          </div>
                          {u.body && (
                            <p className="mt-2 text-sm leading-relaxed text-on-surface">
                              {u.body}
                            </p>
                          )}
                          {u.hasPhoto && (
                            <AttachedPhoto
                              src={`/api/updates/${u.id}/photo`}
                              alt={u.body || "Field photo"}
                            />
                          )}
                          {u.latitude != null && u.longitude != null && (
                            <p className="mono-data mt-2 text-[10px] uppercase tracking-wider text-on-surface-variant">
                              ◎ {u.latitude.toFixed(4)}, {u.longitude.toFixed(4)}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </section>

          <aside className="space-y-gutter">
            <div className="glass-panel rounded-xl p-6">
              <p className="label-caps text-surface-tint">Linked Needs</p>
              <h3 className="heading mt-1 text-lg font-semibold text-on-surface">
                Volunteer Requests
              </h3>
              <p className="mt-1 text-[11px] text-on-surface-variant">
                Reported needs tied to this incident — feed the federated matcher.
              </p>

              {needs.length === 0 ? (
                <div className="mt-4 rounded-md border border-dashed border-black/10 bg-surface-container-low/50 p-6 text-center text-xs text-on-surface-variant">
                  No reported needs linked yet.
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {needs.map(n => (
                    <NeedRow key={n.id} need={n as any} viewerNgoId={session?.ngoId} />
                  ))}
                </ul>
              )}

              <IncidentNeedForm
                incidentId={incident.id}
                incidentLat={incident.latitude}
                incidentLng={incident.longitude}
                incidentLocationLabel={incident.locationLabel}
                ngos={postNgos}
                defaultNgoId={searchParams.ngo}
                mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
              />
            </div>

            <div className="glass-panel rounded-xl p-6">
              <p className="label-caps text-surface-tint">Why this exists</p>
              <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                Incidents outlive a single match. The next NGO that arrives on
                scene reads this timeline first — saving time, avoiding repeated
                hazards, and knowing what resources are already in motion.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  valueText,
}: {
  label: string;
  value?: number;
  valueText?: string;
}) {
  return (
    <div>
      <p className="heading text-2xl font-semibold text-on-surface">
        {valueText ?? (value != null ? <CountUp value={value} /> : null)}
      </p>
      <p className="label-caps mt-1">{label}</p>
    </div>
  );
}
