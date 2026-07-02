"use client";
// NGO-side form → POST /api/users. Adds a helper (volunteer) to this NGO with
// optional position + skills so the new helper is immediately matchable.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidEmail } from "@/lib/validation";

type Skill = { id: string; name: string };

export function AddHelperForm({
  ngoId,
  skills,
  defaultLat,
  defaultLng,
}: {
  ngoId: string;
  skills: Skill[];
  defaultLat: number;
  defaultLng: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // The credential to share with the new helper, shown once after creation.
  const [cred, setCred] = useState<{ email: string; password: string } | null>(null);
  const [latitude, setLatitude] = useState(String(defaultLat));
  const [longitude, setLongitude] = useState(String(defaultLng));
  const [maxRadiusKm, setMaxRadiusKm] = useState("15");
  // Map of selected skillId → proficiency level (1–5). Presence in the map
  // means the skill is selected; new selections default to level 3.
  const [skillLevels, setSkillLevels] = useState<Record<string, number>>({});

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

  const selectedSkills = skills.filter(s => s.id in skillLevels);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setCred(null);
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.trim() && password.trim().length < 6) {
      setError("Default password must be at least 6 characters (or leave blank to auto-generate).");
      return;
    }
    setPending(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        ngoId,
        role: "VOLUNTEER",
        password: password.trim() || undefined,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        maxRadiusKm: parseFloat(maxRadiusKm),
        skills: Object.entries(skillLevels).map(([skillId, level]) => ({ skillId, level })),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setError(error ?? "Failed to add helper");
      return;
    }
    const { user, defaultPassword } = await res.json();
    setOk(`Added ${user.name}. Share these credentials — they'll change the password on first login.`);
    setCred({ email: user.email, password: defaultPassword });
    setName("");
    setEmail("");
    setPassword("");
    setSkillLevels({});
    router.refresh();
  }

  return (
    <div className="glass-panel rounded-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="label-caps text-surface-tint">Team</p>
          <h2 className="heading mt-1 text-xl font-semibold text-on-surface">Add a Helper</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="btn-ghost text-sm"
        >
          {open ? "Cancel" : "+ New"}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="mt-5 grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="label-caps mb-1.5 block">Name</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Sam Volunteer" className="input-field" />
            </label>
            <label>
              <span className="label-caps mb-1.5 block">Email</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="sam@org.org" className="input-field" />
            </label>
          </div>

          <label>
            <span className="label-caps mb-1.5 block">Default password (optional)</span>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Leave blank to auto-generate"
              className="input-field"
            />
            <span className="mt-1 block text-[11px] text-on-surface-variant">
              The helper changes this on first login.
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="label-caps mb-1.5 block">Latitude</span>
              <input value={latitude} onChange={e => setLatitude(e.target.value)} className="input-field mono-data" />
            </label>
            <label>
              <span className="label-caps mb-1.5 block">Longitude</span>
              <input value={longitude} onChange={e => setLongitude(e.target.value)} className="input-field mono-data" />
            </label>
            <label>
              <span className="label-caps mb-1.5 block">Max radius (km)</span>
              <input value={maxRadiusKm} onChange={e => setMaxRadiusKm(e.target.value)} className="input-field mono-data" />
            </label>
          </div>

          {skills.length > 0 && (
            <div>
              <span className="label-caps mb-1.5 block">Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {skills.map(s => {
                  const active = s.id in skillLevels;
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => toggleSkill(s.id)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
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
                <div className="mt-3 space-y-2.5 rounded-md border border-black/5 bg-surface-container-low/40 p-3">
                  <span className="label-caps block text-on-surface-variant">
                    Proficiency · 1 = novice, 5 = expert
                  </span>
                  {selectedSkills.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-on-surface">{s.name}</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map(lvl => {
                          const on = skillLevels[s.id] === lvl;
                          return (
                            <button
                              type="button"
                              key={lvl}
                              onClick={() => setLevel(s.id, lvl)}
                              aria-label={`${s.name} level ${lvl}`}
                              className={`mono-data h-7 w-7 rounded-md border text-[11px] font-semibold transition-colors ${
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

          {error && (
            <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {ok && (
            <p className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
              {ok}
            </p>
          )}
          {cred && (
            <div className="rounded-md border border-primary-container/30 bg-primary-container/10 px-3 py-3 text-sm">
              <p className="label-caps text-on-surface-variant">Login credentials</p>
              <p className="mono-data mt-1.5 text-on-surface">{cred.email}</p>
              <p className="mono-data text-on-surface">
                Password: <span className="text-primary-container">{cred.password}</span>
              </p>
            </div>
          )}

          <div className="flex justify-end border-t border-black/5 pt-4">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Adding…" : "Add Helper"}
              <span>↗</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
