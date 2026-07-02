"use client";
// "My Assignments" on the volunteer's workspace: matches proposed to (or
// accepted by) them, with Accept / Decline / Mark complete actions. This is
// the volunteer's half of the matching loop — the NGO proposes, the
// volunteer responds, the NGO gets notified.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { urgencyColor } from "@/lib/format";
import type { Urgency } from "@prisma/client";

export type Assignment = {
  matchId: string;
  status: "PROPOSED" | "ACCEPTED";
  score: number;
  isCrossNgo: boolean;
  need: {
    id: string;
    rawText: string;
    urgency: Urgency;
    locationLabel: string | null;
    ngoName: string;
    incidentId: string | null;
  };
};

export function AssignmentsPanel({ assignments }: { assignments: Assignment[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(matchId: string, action: "accept" | "decline" | "complete") {
    setBusyId(matchId);
    setError(null);
    const res = await fetch(`/api/matches/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setError(error ?? "Failed to update assignment");
      return;
    }
    router.refresh();
  }

  if (assignments.length === 0) return null;

  return (
    <div className="glass-panel rounded-xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="label-caps text-surface-tint">Matched To You</p>
          <h3 className="heading mt-1 text-xl font-semibold text-on-surface">
            My Assignments
          </h3>
        </div>
        <span className="mono-data rounded-md border border-black/10 bg-surface-container/60 px-3 py-1 text-primary-container">
          {assignments.length}
        </span>
      </div>

      <ul className="space-y-3">
        {assignments.map(a => {
          const busy = busyId === a.matchId;
          const proposed = a.status === "PROPOSED";
          return (
            <li
              key={a.matchId}
              className={`rounded-lg border p-4 ${
                proposed
                  ? "border-primary-container/40 bg-primary-container/[0.06]"
                  : "border-emerald-400/30 bg-emerald-400/[0.06]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${urgencyColor[a.need.urgency]}`}>
                  {a.need.urgency}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                    proposed
                      ? "border-primary-container/40 bg-primary-container/10 text-primary"
                      : "border-emerald-400/40 bg-emerald-400/10 text-emerald-700"
                  }`}
                >
                  {proposed ? "◉ Awaiting your response" : "✔ Accepted — in progress"}
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  for {a.need.ngoName}
                </span>
                {a.isCrossNgo && (
                  <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-1.5 py-0.5 text-[10px] text-fuchsia-700">
                    ◉ Cross-NGO
                  </span>
                )}
              </div>

              <p className="mt-2 text-sm text-on-surface">{a.need.rawText}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-4 text-[11px] text-on-surface-variant">
                {a.need.locationLabel && <span>◎ {a.need.locationLabel}</span>}
                {a.need.incidentId && (
                  <Link href={`/incidents/${a.need.incidentId}`} className="text-primary hover:underline">
                    View incident →
                  </Link>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2 border-t border-black/5 pt-3">
                {proposed ? (
                  <>
                    <button
                      onClick={() => respond(a.matchId, "accept")}
                      disabled={busy}
                      className="btn-primary !px-4 !py-1.5 !text-[11px]"
                    >
                      {busy ? "…" : "Accept"}
                    </button>
                    <button
                      onClick={() => respond(a.matchId, "decline")}
                      disabled={busy}
                      className="rounded-md border border-red-500/30 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => respond(a.matchId, "complete")}
                      disabled={busy}
                      className="btn-primary !px-4 !py-1.5 !text-[11px]"
                    >
                      {busy ? "…" : "★ Mark Complete"}
                    </button>
                    <button
                      onClick={() => respond(a.matchId, "decline")}
                      disabled={busy}
                      className="rounded-md border border-black/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant transition-colors hover:text-red-600 disabled:opacity-50"
                    >
                      Withdraw
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
