// Read-only panel showing volunteers in the current NGO. Server component —
// data is fetched in the parent and passed down.
import type { User } from "@prisma/client";

type Volunteer = User & {
  skills: { skill: { name: string }; level: number }[];
};

const statusStyles: Record<string, string> = {
  AVAILABLE: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  BUSY:      "border-yellow-400/30 bg-yellow-400/10 text-yellow-200",
  OFFLINE:   "border-white/10 bg-white/5 text-on-surface-variant",
};

const statusDot: Record<string, string> = {
  AVAILABLE: "bg-emerald-300 animate-pulse-dot",
  BUSY:      "bg-yellow-300",
  OFFLINE:   "bg-slate-500",
};

export function VolunteerPanel({ volunteers }: { volunteers: Volunteer[] }) {
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
        <div className="rounded-md border border-dashed border-white/10 bg-surface-container-low/50 p-6 text-center text-sm text-on-surface-variant">
          No volunteers in this NGO yet.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {volunteers.map(v => (
            <li
              key={v.id}
              className="group rounded-md border border-white/5 bg-surface-container/50 p-3 transition-colors hover:border-primary-container/30"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-surface-container-low text-[11px] font-semibold text-primary-container">
                    {v.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-on-surface">{v.name}</span>
                </div>
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
                        className="rounded border border-white/5 bg-surface-container-low px-1.5 py-0.5 text-on-surface-variant"
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
