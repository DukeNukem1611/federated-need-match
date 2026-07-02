"use client";
// One row in the needs feed. Encapsulates the per-need actions: share toggle
// and "Find match". Keeps state local so the parent page can stay a server
// component.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { urgencyColor, statusColor, categoryEmoji } from "@/lib/format";
import { AttachedPhoto } from "./AttachedPhoto";
import type { NeedCategory, NeedStatus, Urgency } from "@prisma/client";

type Need = {
  id: string;
  rawText: string;
  category: NeedCategory;
  urgency: Urgency;
  status: NeedStatus;
  isShared: boolean;
  locationLabel: string | null;
  peopleAffected: number | null;
  // Photo bytes are NOT inlined in list payloads — rows carry a flag and the
  // browser fetches /api/needs/:id/photo once (cached) when rendering.
  hasPhoto?: boolean;
  createdAt: string | Date;
  ngo: { id: string; name: string };
  requiredSkills: { skill: { id: string; name: string } }[];
  matches: {
    id: string;
    volunteerId: string;
    score: number;
    isCrossNgo: boolean;
    status: string;
    volunteer?: { id: string; name: string; ngo: { name: string } } | null;
  }[];
};

type Recommendation = {
  volunteer: { id: string; name: string; ngoId: string };
  score: number;
  distanceKm: number;
  matchedSkills: string[];
  isCrossNgo: boolean;
  outOfRange: boolean;
};

type MatchDetails = {
  match: { id: string; volunteerId: string; score: number; isCrossNgo: boolean };
  details: Recommendation;
  recommendations: Recommendation[];
};

export function NeedRow({ need, viewerNgoId }: { need: Need; viewerNgoId?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [matchResult, setMatchResult] = useState<MatchDetails | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwn = !viewerNgoId || need.ngo.id === viewerNgoId;

  async function deleteNeed() {
    setDeleting(true);
    setMatchError(null);
    const res = await fetch(`/api/needs/${need.id}`, { method: "DELETE" });
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      setDeleting(false);
      setConfirmDelete(false);
      setMatchError("Failed to remove this need.");
    }
  }

  async function toggleShare() {
    await fetch(`/api/needs/${need.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isShared: !need.isShared }),
    });
    startTransition(() => router.refresh());
  }

  async function runMatch() {
    setMatchError(null);
    setMatchResult(null);
    const res = await fetch(`/api/needs/${need.id}/match?k=5`, { method: "POST" });
    if (res.status === 404) {
      setMatchError(
        need.isShared
          ? "No suitable volunteer in own NGO or federated network."
          : "No suitable volunteer in own NGO. Try toggling 'Share' to widen the search.",
      );
      return;
    }
    if (!res.ok) {
      setMatchError("Match request failed");
      return;
    }
    setMatchResult(await res.json());
    startTransition(() => router.refresh());
  }

  return (
    <li className="group relative overflow-hidden rounded-lg border border-black/5 bg-surface-container/60 p-4 transition-all hover:border-primary-container/30 hover:bg-surface-container">
      <div className="absolute inset-y-0 left-0 w-[2px] origin-top scale-y-0 bg-primary-container transition-transform duration-300 group-hover:scale-y-100" />

      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-black/5 bg-surface-container-low text-xl">
          {categoryEmoji[need.category]}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Chip className={urgencyColor[need.urgency]}>{need.urgency}</Chip>
            <Chip className={statusColor[need.status]}>{need.status}</Chip>
            <span className="label-caps text-on-surface-variant">{need.category}</span>
            {need.isShared && (
              <Chip className="border border-primary-container/40 bg-primary-container/10 text-primary">
                ◉ Shared
              </Chip>
            )}
            {!isOwn && (
              <Chip className="border border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-700">
                from {need.ngo.name}
              </Chip>
            )}
          </div>

          <p className="mt-3 text-sm text-on-surface">{need.rawText}</p>

          {need.hasPhoto && (
            <AttachedPhoto src={`/api/needs/${need.id}/photo`} alt={need.rawText} />
          )}

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-on-surface-variant">
            {need.locationLabel && (
              <span className="flex items-center gap-1">
                <span className="text-primary-container">◎</span>
                {need.locationLabel}
              </span>
            )}
            {need.peopleAffected != null && (
              <span className="flex items-center gap-1">
                <span className="text-primary-container">✦</span>
                {need.peopleAffected} affected
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="text-primary-container">⟐</span>
              needs: {need.requiredSkills.map(s => s.skill.name).join(", ") || "—"}
            </span>
          </div>
        </div>

        {isOwn && (
          <div className="flex shrink-0 flex-col gap-2">
            <button
              onClick={runMatch}
              disabled={pending || need.status === "RESOLVED" || need.status === "CANCELLED"}
              className="btn-primary !px-4 !py-2 !text-[11px]"
            >
              {pending
                ? "Matching…"
                : matchResult || need.matches.length > 0
                ? "↻ Refresh Match"
                : "Find Match"}
            </button>
            <button
              onClick={toggleShare}
              disabled={pending}
              className="btn-ghost !px-4 !py-2 !text-[11px]"
            >
              {need.isShared ? "Unshare" : "Share"}
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={pending}
                className="rounded-md border border-red-500/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50"
              >
                Remove
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button
                  onClick={deleteNeed}
                  disabled={deleting}
                  className="flex-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-700 disabled:opacity-50"
                >
                  {deleting ? "…" : "Confirm"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="flex-1 rounded-md border border-black/10 px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {matchError && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-700">
          <span className="text-amber-600">⚠</span>
          <span>{matchError}</span>
        </div>
      )}

      {matchResult && (
        <div className="mt-4 space-y-3">
          <div className="relative overflow-hidden rounded-md border border-emerald-400/30 bg-emerald-400/10 p-4">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-emerald-400/50" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse-dot rounded-full bg-emerald-300" />
                <span className="heading text-base font-semibold text-emerald-700">
                  {matchResult.details.volunteer.name}
                </span>
                <span className="label-caps text-emerald-600">Matched</span>
              </div>
              <span className="mono-data rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-700">
                {matchResult.details.score}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-700/80">
              <span>◎ {matchResult.details.distanceKm} km</span>
              <span>⟐ {matchResult.details.matchedSkills.length} skills</span>
              {matchResult.details.isCrossNgo && (
                <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-2 py-0.5 text-fuchsia-700">
                  ◉ Cross-NGO
                </span>
              )}
              {matchResult.details.outOfRange && (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-amber-700">
                  ⚠ beyond radius
                </span>
              )}
            </div>
          </div>

          {matchResult.recommendations.length > 1 && (
            <div className="rounded-md border border-black/5 bg-surface-container-low/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="label-caps text-surface-tint">
                  Alternate Candidates
                </p>
                <span className="mono-data text-[11px] text-on-surface-variant">
                  {matchResult.recommendations.length - 1} ranked
                </span>
              </div>
              <ol className="space-y-1.5">
                {matchResult.recommendations.slice(1).map((r, i) => (
                  <li
                    key={r.volunteer.id}
                    className="flex items-center justify-between gap-3 rounded border border-black/5 bg-surface-container/40 px-3 py-2 text-xs hover:border-primary-container/30"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="mono-data w-7 text-center text-on-surface-variant">
                        #{i + 2}
                      </span>
                      <span className="truncate text-sm font-medium text-on-surface">
                        {r.volunteer.name}
                      </span>
                      {r.isCrossNgo && (
                        <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-1.5 py-0.5 text-[10px] text-fuchsia-700">
                          ◉ x-NGO
                        </span>
                      )}
                      {r.outOfRange && (
                        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-700">
                          ⚠ far
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-on-surface-variant">
                      <span className="mono-data">{r.distanceKm} km</span>
                      <span className="mono-data">{r.matchedSkills.length} sk</span>
                      <span className="mono-data rounded border border-black/10 bg-surface-container-low px-2 py-0.5 text-primary-container">
                        {r.score}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {!matchResult && need.matches.length > 0 && (
        <div className="mt-4 rounded-md border border-emerald-400/20 bg-emerald-400/[0.07] p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              <span className="heading text-sm font-semibold text-emerald-700">
                {need.matches[0].volunteer?.name ?? "Assigned volunteer"}
              </span>
              {need.matches[0].volunteer?.ngo?.name && (
                <span className="text-[11px] text-emerald-700/70">
                  · {need.matches[0].volunteer.ngo.name}
                </span>
              )}
              {need.matches[0].isCrossNgo && (
                <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-1.5 py-0.5 text-[10px] text-fuchsia-700">
                  ◉ Cross-NGO
                </span>
              )}
              <span className="label-caps text-emerald-600/80">{need.matches[0].status}</span>
            </div>
            <span className="mono-data shrink-0 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-700">
              {need.matches[0].score}
            </span>
          </div>
        </div>
      )}
    </li>
  );
}

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${className}`}
    >
      {children}
    </span>
  );
}
