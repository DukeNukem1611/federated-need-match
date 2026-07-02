"use client";
// Lets a volunteer set their own availability and self-report what they're
// currently working on — a specific incident, or a need (their NGO's own or a
// shared one from the network). PATCHes /api/users/:id and refreshes.
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VolunteerStatus } from "@prisma/client";

type IncidentOpt = { id: string; title: string; locationLabel: string };
type NeedOpt = {
  id: string;
  label: string;
  ngoName: string;
  isShared: boolean;
  own: boolean;
};

const STATUS_META: Record<VolunteerStatus, { label: string; cls: string; activeCls: string }> = {
  AVAILABLE: {
    label: "Available",
    cls: "border-emerald-400/30 text-emerald-700 hover:border-emerald-400/50",
    activeCls: "border-emerald-400/60 bg-emerald-500/15 text-emerald-700",
  },
  BUSY: {
    label: "Busy",
    cls: "border-amber-400/30 text-amber-700 hover:border-amber-400/50",
    activeCls: "border-amber-400/60 bg-amber-500/15 text-amber-700",
  },
  OFFLINE: {
    label: "Offline",
    cls: "border-black/10 text-on-surface-variant hover:border-black/20",
    activeCls: "border-black/40 bg-black/10 text-on-surface",
  },
};

const STATUSES: VolunteerStatus[] = ["AVAILABLE", "BUSY", "OFFLINE"];

export function VolunteerStatusPanel({
  userId,
  initialStatus,
  initialActiveIncidentId,
  initialActiveNeedId,
  incidents,
  needs,
}: {
  userId: string;
  initialStatus: VolunteerStatus;
  initialActiveIncidentId: string | null;
  initialActiveNeedId: string | null;
  incidents: IncidentOpt[];
  needs: NeedOpt[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<VolunteerStatus>(initialStatus);
  const [mode, setMode] = useState<"none" | "incident" | "need">(
    initialActiveIncidentId ? "incident" : initialActiveNeedId ? "need" : "none",
  );
  const [targetId, setTargetId] = useState<string>(
    initialActiveIncidentId ?? initialActiveNeedId ?? "",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Dirty check so the Save button only lights up when something changed.
  const baselineMode = initialActiveIncidentId
    ? "incident"
    : initialActiveNeedId
    ? "need"
    : "none";
  const baselineTarget = initialActiveIncidentId ?? initialActiveNeedId ?? "";
  const dirty =
    status !== initialStatus ||
    mode !== baselineMode ||
    (mode !== "none" && targetId !== baselineTarget);

  function chooseMode(next: "none" | "incident" | "need") {
    setMode(next);
    // Reset the selection when switching target type.
    if (next === "none") setTargetId("");
    else if (next !== mode) setTargetId("");
  }

  async function save() {
    setError(null);
    if (mode !== "none" && !targetId) {
      setError(`Select ${mode === "incident" ? "an incident" : "a need"} or choose "Not deployed".`);
      return;
    }
    setPending(true);
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        activeIncidentId: mode === "incident" ? targetId : null,
        activeNeedId: mode === "need" ? targetId : null,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setError(error ?? "Failed to update");
      return;
    }
    setSavedAt(Date.now());
    router.refresh();
  }

  return (
    <div className="glass-panel rounded-xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="label-caps text-surface-tint">My Status</p>
          <h2 className="heading mt-1 text-xl font-semibold text-on-surface">
            Availability &amp; Deployment
          </h2>
        </div>
        {savedAt && !dirty && (
          <span className="mono-data text-[11px] uppercase tracking-wider text-emerald-600">
            ✓ Saved
          </span>
        )}
      </div>

      {/* Availability */}
      <p className="label-caps mb-2">Availability</p>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map(s => {
          const meta = STATUS_META[s];
          const active = s === status;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full border px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                active ? meta.activeCls : `bg-surface-container/40 ${meta.cls}`
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Deployment */}
      <p className="label-caps mb-2 mt-6">Currently working on</p>
      <div className="flex flex-wrap gap-2">
        {([
          ["none", "Not deployed"],
          ["incident", "An incident"],
          ["need", "A need"],
        ] as const).map(([m, lbl]) => (
          <button
            key={m}
            type="button"
            onClick={() => chooseMode(m)}
            className={`rounded-full border px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors ${
              mode === m
                ? "border-primary-container/60 bg-primary-container/15 text-primary"
                : "border-black/10 bg-surface-container/40 text-on-surface-variant hover:border-primary-container/40 hover:text-primary"
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {mode === "incident" && (
        <select
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
          className="input-field mt-3 text-sm"
        >
          <option value="" className="bg-surface-container-low">Select an incident…</option>
          {incidents.map(i => (
            <option key={i.id} value={i.id} className="bg-surface-container-low text-on-surface">
              {i.title} — {i.locationLabel}
            </option>
          ))}
        </select>
      )}

      {mode === "need" && (
        <select
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
          className="input-field mt-3 text-sm"
        >
          <option value="" className="bg-surface-container-low">Select a need…</option>
          {needs.map(n => (
            <option key={n.id} value={n.id} className="bg-surface-container-low text-on-surface">
              {n.own ? "★ " : n.isShared ? "◇ " : ""}{n.label} — {n.ngoName}
            </option>
          ))}
        </select>
      )}

      {mode === "need" && needs.length > 0 && (
        <p className="mt-2 text-[11px] text-on-surface-variant">
          <span className="text-amber-600">★</span> your NGO&rsquo;s need ·{" "}
          <span className="text-primary-container">◇</span> shared from the network
        </p>
      )}

      {((mode === "incident" && incidents.length === 0) ||
        (mode === "need" && needs.length === 0)) && (
        <p className="mt-3 rounded-md border border-dashed border-black/10 bg-surface-container-low/50 p-3 text-center text-xs text-on-surface-variant">
          Nothing available to select right now.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end border-t border-black/5 pt-4">
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="btn-primary text-sm"
        >
          {pending ? "Saving…" : "Update Status"}
          <span>↗</span>
        </button>
      </div>
    </div>
  );
}
