"use client";
// Per-helper edit/delete controls for the volunteer panel. Edit expands an
// inline form (name/email/status/position + skill levels) that PATCHes the
// helper; Delete uses a two-step inline confirm then DELETEs. Both refresh
// the server component on success.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidEmail } from "@/lib/validation";

type Skill = { id: string; name: string };

export type EditableHelper = {
  id: string;
  name: string;
  email: string;
  status: string | null;
  latitude: number | null;
  longitude: number | null;
  maxRadiusKm: number | null;
  skills: { skillId: string; level: number }[];
};

const STATUSES = ["AVAILABLE", "BUSY", "OFFLINE"] as const;

export function HelperActions({
  volunteer,
  allSkills,
}: {
  volunteer: EditableHelper;
  allSkills: Skill[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(volunteer.name);
  const [email, setEmail] = useState(volunteer.email);
  const [status, setStatus] = useState(volunteer.status ?? "AVAILABLE");
  const [latitude, setLatitude] = useState(volunteer.latitude != null ? String(volunteer.latitude) : "");
  const [longitude, setLongitude] = useState(volunteer.longitude != null ? String(volunteer.longitude) : "");
  const [maxRadiusKm, setMaxRadiusKm] = useState(volunteer.maxRadiusKm != null ? String(volunteer.maxRadiusKm) : "");
  const [skillLevels, setSkillLevels] = useState<Record<string, number>>(
    Object.fromEntries(volunteer.skills.map(s => [s.skillId, s.level])),
  );

  const selectedSkills = allSkills.filter(s => s.id in skillLevels);

  function toggleSkill(id: string) {
    setSkillLevels(prev => {
      if (id in prev) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: 3 };
    });
  }
  function setLevel(id: string, level: number) {
    setSkillLevels(prev => ({ ...prev, [id]: level }));
  }

  function resetFromProps() {
    setName(volunteer.name);
    setEmail(volunteer.email);
    setStatus(volunteer.status ?? "AVAILABLE");
    setLatitude(volunteer.latitude != null ? String(volunteer.latitude) : "");
    setLongitude(volunteer.longitude != null ? String(volunteer.longitude) : "");
    setMaxRadiusKm(volunteer.maxRadiusKm != null ? String(volunteer.maxRadiusKm) : "");
    setSkillLevels(Object.fromEntries(volunteer.skills.map(s => [s.skillId, s.level])));
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setPending(true);
    const res = await fetch(`/api/users/${volunteer.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        status,
        latitude,
        longitude,
        maxRadiusKm,
        skills: Object.entries(skillLevels).map(([skillId, level]) => ({ skillId, level })),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed to save." }));
      setError(error ?? "Failed to save.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    setError(null);
    setPending(true);
    const res = await fetch(`/api/users/${volunteer.id}`, { method: "DELETE" });
    setPending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed to delete." }));
      setError(error ?? "Failed to delete.");
      return;
    }
    router.refresh();
  }

  async function resetPassword() {
    setError(null);
    setPending(true);
    const res = await fetch(`/api/users/${volunteer.id}/reset-password`, { method: "POST" });
    setPending(false);
    setConfirmReset(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed to reset password." }));
      setError(error ?? "Failed to reset password.");
      return;
    }
    const { defaultPassword } = await res.json();
    setResetResult(defaultPassword);
  }

  return (
    <div className="mt-2 pl-9">
      {!editing ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              resetFromProps();
              setEditing(true);
            }}
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant transition-colors hover:text-primary"
          >
            Edit
          </button>
          {!confirmDel ? (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant transition-colors hover:text-red-600"
            >
              Delete
            </button>
          ) : (
            <span className="flex items-center gap-2 text-[11px]">
              <span className="text-on-surface-variant">Remove?</span>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="font-semibold uppercase tracking-[0.08em] text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {pending ? "…" : "Yes"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDel(false)}
                className="font-semibold uppercase tracking-[0.08em] text-on-surface-variant hover:text-on-surface"
              >
                No
              </button>
            </span>
          )}
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant transition-colors hover:text-amber-600"
              title="Issue a new default password"
            >
              Reset password
            </button>
          ) : (
            <span className="flex items-center gap-2 text-[11px]">
              <span className="text-on-surface-variant">New password?</span>
              <button
                type="button"
                onClick={resetPassword}
                disabled={pending}
                className="font-semibold uppercase tracking-[0.08em] text-amber-600 hover:text-amber-700 disabled:opacity-50"
              >
                {pending ? "…" : "Yes"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="font-semibold uppercase tracking-[0.08em] text-on-surface-variant hover:text-on-surface"
              >
                No
              </button>
            </span>
          )}
          {error && <span className="text-[11px] text-red-600">{error}</span>}
        </div>
      ) : (
        <form onSubmit={save} className="mt-1 grid gap-2.5 rounded-md border border-black/5 bg-surface-container-low/40 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="label-caps mb-1 block">Name</span>
              <input value={name} onChange={e => setName(e.target.value)} className="input-field py-1.5 text-xs" />
            </label>
            <label>
              <span className="label-caps mb-1 block">Status</span>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="input-field py-1.5 text-xs"
              >
                {STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            <span className="label-caps mb-1 block">Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field py-1.5 text-xs" />
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label>
              <span className="label-caps mb-1 block">Lat</span>
              <input value={latitude} onChange={e => setLatitude(e.target.value)} className="input-field mono-data py-1.5 text-xs" />
            </label>
            <label>
              <span className="label-caps mb-1 block">Lng</span>
              <input value={longitude} onChange={e => setLongitude(e.target.value)} className="input-field mono-data py-1.5 text-xs" />
            </label>
            <label>
              <span className="label-caps mb-1 block">Radius</span>
              <input value={maxRadiusKm} onChange={e => setMaxRadiusKm(e.target.value)} className="input-field mono-data py-1.5 text-xs" />
            </label>
          </div>

          {allSkills.length > 0 && (
            <div>
              <span className="label-caps mb-1 block">Skills</span>
              <div className="flex flex-wrap gap-1">
                {allSkills.map(s => {
                  const active = s.id in skillLevels;
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => toggleSkill(s.id)}
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors ${
                        active
                          ? "border-primary-container/50 bg-primary-container/10 text-primary"
                          : "border-black/10 bg-surface-container/50 text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>

              {selectedSkills.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {selectedSkills.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-on-surface">{s.name}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(lvl => {
                          const on = skillLevels[s.id] === lvl;
                          return (
                            <button
                              type="button"
                              key={lvl}
                              onClick={() => setLevel(s.id, lvl)}
                              aria-label={`${s.name} level ${lvl}`}
                              className={`mono-data h-6 w-6 rounded border text-[10px] font-semibold transition-colors ${
                                on
                                  ? "border-primary-container/60 bg-primary-container/15 text-primary"
                                  : "border-black/10 bg-surface-container/50 text-on-surface-variant hover:text-on-surface"
                              }`}
                            >
                              {lvl}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-[11px] text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 border-t border-black/5 pt-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary-container px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-primary transition-all hover:shadow-glow-cyan-strong disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}

      {resetResult && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-800">
          <span>
            New password: <span className="mono-data font-semibold">{resetResult}</span>{" "}
            — share it with {volunteer.name}; they must change it at next login.
          </span>
          <button
            type="button"
            onClick={() => setResetResult(null)}
            className="ml-auto font-semibold uppercase tracking-[0.08em] text-amber-700 hover:text-amber-900"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
