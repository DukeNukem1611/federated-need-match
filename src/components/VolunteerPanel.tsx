// Read-only panel showing volunteers in the current NGO. Server component —
// data is fetched in the parent and passed down.
import Link from "next/link";
import type { User } from "@prisma/client";
import { HelperActions } from "./HelperActions";

type Volunteer = User & {
  skills: { skillId: string; skill: { name: string }; level: number }[];
  activeIncident?: { id: string; title: string } | null;
  activeNeed?: { id: string; rawText: string } | null;
  // Filtered relation count from the dashboard query: COMPLETED matches.
  _count?: { matches: number };
};

type Skill = { id: string; name: string };

const statusStyles: Record<string, string> = {
  AVAILABLE: "border-emerald-400/30 bg-emerald-400/10 text-emerald-700",
  BUSY:      "border-yellow-400/30 bg-yellow-400/10 text-yellow-700",
  OFFLINE:   "border-black/10 bg-black/5 text-on-surface-variant",
};

const statusDot: Record<string, string> = {
  AVAILABLE: "bg-emerald-300 animate-pulse-dot",
  BUSY:      "bg-yellow-300",
  OFFLINE:   "bg-slate-500",
};

export function VolunteerPanel({
  volunteers,
  allSkills = [],
  canManage = true,
}: {
  volunteers: Volunteer[];
  allSkills?: Skill[];
  // When false (e.g. a volunteer viewing their own NGO dashboard), the
  // edit/delete controls are hidden — management is an NGO-admin action.
  canManage?: boolean;
}) {
  const available = volunteers.filter(v => v.status === "AVAILABLE").length;

  return (
    <div className="glass-panel rounded-xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="label-caps text-surface-tint">Volunteer Pool</p>
          <h3 className="heading mt-1 text-xl font-semibold text-on-surface">
            Active Roster
          </h3>
        </div>
        <div className="flex flex-col items-end">
          <span className="mono-data text-2xl font-semibold text-primary-container">
            {available}
            <span className="text-on-surface-variant">/{volunteers.length}</span>
          </span>
          <span className="label-caps text-on-surface-variant">Available</span>
        </div>
      </div>

      {volunteers.length === 0 ? (
        <div className="rounded-md border border-dashed border-black/10 bg-surface-container-low/50 p-6 text-center text-sm text-on-surface-variant">
          No volunteers in this NGO yet.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {volunteers.map(v => (
            <li
              key={v.id}
              className="group rounded-md border border-black/5 bg-surface-container/50 p-3 transition-colors hover:border-primary-container/30"
            >
              <div className="flex items-center justify-between">
                <Link href={`/user/${v.id}`} className="flex items-center gap-2.5 hover:opacity-80">
                  {v.avatarData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={v.avatarData}
                      alt={v.name}
                      className="h-7 w-7 rounded-full border border-black/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-surface-container-low text-[11px] font-semibold text-primary-container">
                      {v.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-on-surface hover:text-primary-container">{v.name}</span>
                  {(v._count?.matches ?? 0) > 0 && (
                    <span
                      className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
                      title={`${v._count!.matches} completed assignment${v._count!.matches > 1 ? "s" : ""}`}
                    >
                      ★ {v._count!.matches}
                    </span>
                  )}
                </Link>
                <span
                  className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusStyles[v.status ?? "OFFLINE"]}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDot[v.status ?? "OFFLINE"]}`} />
                  {v.status}
                </span>
              </div>
              <div className="mt-2 pl-9 text-[11px] text-on-surface-variant">
                <div className="flex flex-wrap gap-1">
                  {v.skills.length === 0 ? (
                    <span className="italic">no skills</span>
                  ) : (
                    v.skills.map(s => (
                      <span
                        key={s.skill.name}
                        className="rounded border border-black/5 bg-surface-container-low px-1.5 py-0.5 text-on-surface-variant"
                      >
                        {s.skill.name}{" "}
                        <span className="mono-data text-primary-container">L{s.level}</span>
                      </span>
                    ))
                  )}
                </div>
                {v.maxRadiusKm != null && (
                  <div className="mt-1.5 mono-data text-[10px] text-on-surface-variant">
                    radius {v.maxRadiusKm} km
                  </div>
                )}
                {(v.activeIncident || v.activeNeed) && (
                  <div className="mt-1.5 text-[10px] text-primary-container">
                    ▶ {v.activeIncident
                      ? v.activeIncident.title
                      : v.activeNeed!.rawText.length > 50
                      ? v.activeNeed!.rawText.slice(0, 50) + "…"
                      : v.activeNeed!.rawText}
                  </div>
                )}
              </div>
              {canManage && (
                <HelperActions
                  volunteer={{
                    id: v.id,
                    name: v.name,
                    email: v.email,
                    status: v.status,
                    latitude: v.latitude,
                    longitude: v.longitude,
                    maxRadiusKm: v.maxRadiusKm,
                    skills: v.skills.map(s => ({ skillId: s.skillId, level: s.level })),
                  }}
                  allSkills={allSkills}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
