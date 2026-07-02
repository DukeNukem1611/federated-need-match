"use client";
// Click-to-change status pill on the incident detail page. Confirming a
// new status does two things in sequence:
//   1. PATCH /api/incidents/:id   — flips the row's status field.
//   2. POST  /api/incidents/:id/updates — records the change in the
//      timeline (kind = RESOLUTION when resolved, STATUS otherwise),
//      so any NGO arriving later sees who changed it and why.
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { incidentStatusColor, incidentStatusDot } from "@/lib/format";
import type { IncidentStatus } from "@prisma/client";

const STATUS_ORDER: IncidentStatus[] = ["ACTIVE", "MONITORING", "RESOLVED", "ARCHIVED"];

const DEFAULT_NOTE: Record<IncidentStatus, string> = {
  ACTIVE:     "Re-opened — situation active again.",
  MONITORING: "Moved to monitoring — situation contained but watching.",
  RESOLVED:   "Resolved — incident closed.",
  ARCHIVED:   "Archived for the record.",
};

export function IncidentStatusChanger({
  incidentId,
  currentStatus,
  ngos,
  defaultNgoId,
}: {
  incidentId: string;
  currentStatus: IncidentStatus;
  ngos: { id: string; name: string }[];
  defaultNgoId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<IncidentStatus>(currentStatus);
  // When exactly one NGO is passed the identity is fixed (session-locked) —
  // no dropdown. Ignore a defaultNgoId that isn't in the allowed list.
  const lockedNgo = ngos.length === 1 ? ngos[0] : null;
  const [ngoId, setNgoId] = useState(
    lockedNgo?.id ??
      (defaultNgoId && ngos.some(n => n.id === defaultNgoId) ? defaultNgoId : ngos[0]?.id ?? ""),
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click + Escape so the popover doesn't trap focus.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function submit() {
    setError(null);
    if (target === currentStatus) {
      setOpen(false);
      return;
    }
    if (!ngoId) {
      setError("Choose which NGO is making this change.");
      return;
    }
    setBusy(true);

    const patchRes = await fetch(`/api/incidents/${incidentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: target }),
    });
    if (!patchRes.ok) {
      setBusy(false);
      setError("Failed to update status.");
      return;
    }

    // Log the change in the shared timeline so it isn't a silent edit.
    const kind = target === "RESOLVED" ? "RESOLUTION" : "STATUS";
    const body = note.trim() || `${DEFAULT_NOTE[target]} (was ${currentStatus})`;
    await fetch(`/api/incidents/${incidentId}/updates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ngoId, kind, body }),
    });

    setBusy(false);
    setNote("");
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setTarget(currentStatus);
          setOpen(o => !o);
        }}
        className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-opacity hover:opacity-90 ${incidentStatusColor[currentStatus]}`}
        title="Change status"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${incidentStatusDot[currentStatus]}`} />
        {currentStatus}
        <span className="opacity-60">▾</span>
      </button>

      {open && (
        <div className="glass-panel absolute left-0 lg:left-auto lg:right-0 top-full z-20 mt-2 w-80 rounded-md p-4 shadow-glow-cyan">
          <p className="label-caps text-surface-tint">Change Status</p>
          <h4 className="heading mt-1 text-sm font-semibold text-on-surface">
            What&rsquo;s the new state?
          </h4>

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {STATUS_ORDER.map(s => {
              const active = s === target;
              return (
                <button
                  type="button"
                  key={s}
                  onClick={() => setTarget(s)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                    active
                      ? incidentStatusColor[s] + " ring-1 ring-black/20"
                      : "border-black/10 bg-surface-container/50 text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${incidentStatusDot[s]}`} />
                  {s}
                </button>
              );
            })}
          </div>

          <div className="mt-3">
            <span className="label-caps mb-1 block">Posting as</span>
            {lockedNgo ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-primary-container/30 bg-primary-container/10 px-2.5 py-1.5 text-xs font-medium text-primary">
                ◆ {lockedNgo.name}
              </span>
            ) : (
              <select
                value={ngoId}
                onChange={e => setNgoId(e.target.value)}
                className="input-field text-xs"
              >
                {ngos.map(n => (
                  <option key={n.id} value={n.id} className="bg-surface-container-low text-on-surface">
                    {n.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="mt-3">
            <span className="label-caps mb-1 block">Note (optional)</span>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder={DEFAULT_NOTE[target]}
              className="input-field resize-none text-xs"
            />
          </div>

          {error && (
            <p className="mt-2 rounded-md border border-red-400/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-700">
              {error}
            </p>
          )}

          <div className="mt-3 flex items-center justify-end gap-2 border-t border-black/5 pt-3">
            <button
              type="button"
              className="btn-ghost !px-3 !py-1.5 !text-[10px]"
              onClick={() => setOpen(false)}
              disabled={busy || pending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary !px-4 !py-1.5 !text-[10px]"
              onClick={submit}
              disabled={busy || pending || target === currentStatus}
            >
              {busy ? "Updating…" : target === currentStatus ? "Same status" : "Confirm"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
