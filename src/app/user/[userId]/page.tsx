// Volunteer's personal page. Shows their identity + live notification feed,
// and lets them file an incident (which in turn notifies everyone).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePageAuth } from "@/lib/auth";
import { NotificationFeed } from "@/components/NotificationFeed";
import { NotificationBell } from "@/components/NotificationBell";
import { PushManager } from "@/components/PushManager";
import { VolunteerStatusPanel } from "@/components/VolunteerStatusPanel";
import { AuthMenu } from "@/components/AuthMenu";
import { AvatarUpload } from "@/components/AvatarUpload";
import { AssignmentsPanel, type Assignment } from "@/components/AssignmentsPanel";
import { LiveEyebrow, ScanLine } from "@/components/section";

export const dynamic = "force-dynamic";

export default async function UserPage({ params }: { params: { userId: string } }) {
  // A user may only view their own workspace. (Super-admin has no user session
  // and is allowed through for support/debugging.)
  const { session } = await requirePageAuth();
  if (session && session.uid !== params.userId) {
    redirect(session.role === "ADMIN" ? `/dashboard/${session.ngoId}` : `/user/${session.uid}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    include: {
      ngo: { select: { id: true, name: true, slug: true } },
      skills: { include: { skill: true } },
      activeIncident: { select: { id: true, title: true } },
      activeNeed: { select: { id: true, rawText: true } },
    },
  });
  if (!user) notFound();

  const isVolunteer = user.role === "VOLUNTEER";

  // Open assignments: matches proposed to (or accepted by) this volunteer.
  const matchRows = isVolunteer
    ? await prisma.match.findMany({
        where: { volunteerId: user.id, status: { in: ["PROPOSED", "ACCEPTED"] } },
        orderBy: { createdAt: "desc" },
        include: {
          need: {
            select: {
              id: true, rawText: true, urgency: true, locationLabel: true,
              incidentId: true, status: true, ngo: { select: { name: true } },
            },
          },
        },
      })
    : [];
  const assignments: Assignment[] = matchRows
    // A resolved/cancelled need no longer needs a response.
    .filter(m => m.need.status !== "RESOLVED" && m.need.status !== "CANCELLED")
    .map(m => ({
      matchId: m.id,
      status: m.status as "PROPOSED" | "ACCEPTED",
      score: m.score,
      isCrossNgo: m.isCrossNgo,
      need: {
        id: m.need.id,
        rawText: m.need.rawText,
        urgency: m.need.urgency,
        locationLabel: m.need.locationLabel,
        ngoName: m.need.ngo.name,
        incidentId: m.need.incidentId,
      },
    }));

  // Options the volunteer can deploy to: live incidents (shared across NGOs)
  // and needs that are either their own NGO's or shared from the network.
  const [incidentOpts, needRows] = isVolunteer
    ? await Promise.all([
        prisma.incident.findMany({
          where: { status: { in: ["ACTIVE", "MONITORING"] } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, locationLabel: true },
        }),
        prisma.reportedNeed.findMany({
          where: {
            status: { in: ["OPEN", "MATCHED", "IN_PROGRESS"] },
            OR: [{ ngoId: user.ngoId }, { isShared: true }],
          },
          orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
          select: {
            id: true, rawText: true, isShared: true, ngoId: true,
            ngo: { select: { name: true } },
          },
        }),
      ])
    : [[], []];

  const needOpts = needRows.map(n => ({
    id: n.id,
    label: n.rawText.length > 60 ? n.rawText.slice(0, 60) + "…" : n.rawText,
    ngoName: n.ngo.name,
    isShared: n.isShared,
    own: n.ngoId === user.ngoId,
  }));

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full bg-primary-container/10 blur-[140px]" />

      <nav className="relative z-50 border-b border-black/5 bg-surface/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-6 py-4 sm:px-10">
          <Link href="/" className="flex items-center gap-3 text-primary-container hover:text-primary">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-primary-container/15">
              <span className="heading text-lg font-bold">◆</span>
            </div>
            <span className="heading text-lg font-bold uppercase tracking-[0.18em]">
              Federated Relief
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href={`/incidents/new?ngoId=${user.ngo.id}`} className="btn-ghost">
              + Incident
            </Link>
            <Link href={`/dashboard/${user.ngo.id}`} className="btn-ghost">
              {user.ngo.name} →
            </Link>
            {session && <PushManager />}
            <NotificationBell userId={user.id} />
            {session && (
              <AuthMenu name={user.name} role={session.role} home={`/user/${user.id}`} />
            )}
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-[960px] px-6 py-10 sm:px-10">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <LiveEyebrow>My Workspace</LiveEyebrow>
            <div className="mt-2 flex items-center gap-4">
              <AvatarUpload
                src={user.avatarData}
                fallback={user.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                endpoint={`/api/users/${user.id}`}
                field="avatarData"
                editable={!session || session.uid === user.id}
                size="lg"
                alt={`${user.name}'s profile picture`}
              />
              <h1 className="heading text-3xl font-bold text-on-surface sm:text-4xl">
                {user.name}
              </h1>
            </div>
            <ScanLine className="mt-2.5 w-24" />
            <p className="mono-data mt-2 text-xs uppercase tracking-widest text-on-surface-variant">
              {user.role} · {user.ngo.name}
              {user.status ? ` · ${user.status}` : ""}
            </p>
            {(user.activeIncident || user.activeNeed) && (
              <p className="mt-2 text-xs text-on-surface-variant">
                <span className="text-primary-container">▶ Working on:</span>{" "}
                {user.activeIncident ? (
                  <Link href={`/incidents/${user.activeIncident.id}`} className="text-on-surface hover:text-primary">
                    {user.activeIncident.title}
                  </Link>
                ) : (
                  <span className="text-on-surface">
                    {user.activeNeed!.rawText.length > 70
                      ? user.activeNeed!.rawText.slice(0, 70) + "…"
                      : user.activeNeed!.rawText}
                  </span>
                )}
              </p>
            )}
            {user.skills.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {user.skills.map(s => (
                  <span
                    key={s.skillId}
                    className="rounded-full border border-black/10 bg-surface-container/50 px-2.5 py-0.5 text-[11px] text-on-surface-variant"
                  >
                    {s.skill.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <Link href={`/incidents/new?ngoId=${user.ngo.id}`} className="btn-primary self-start sm:self-auto">
            File an Incident
            <span>↗</span>
          </Link>
        </header>

        {isVolunteer && assignments.length > 0 && (
          <div className="mb-gutter">
            <AssignmentsPanel assignments={assignments} />
          </div>
        )}

        {isVolunteer && user.status && (
          <div className="mb-gutter">
            <VolunteerStatusPanel
              userId={user.id}
              initialStatus={user.status}
              initialActiveIncidentId={user.activeIncidentId}
              initialActiveNeedId={user.activeNeedId}
              incidents={incidentOpts}
              needs={needOpts}
            />
          </div>
        )}

        <NotificationFeed userId={user.id} />
      </section>
    </main>
  );
}
