"use client";
// One row in the needs feed. Encapsulates the per-need actions: share toggle
// and "Find match". Keeps state local so the parent page can stay a server
// component.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { urgencyColor, statusColor, categoryEmoji } from "@/lib/format";
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
  createdAt: string | Date;
  ngo: { id: string; name: string };
  requiredSkills: { skill: { id: string; name: string } }[];
  matches: { id: string; volunteerId: string; score: number; isCrossNgo: boolean }[];
};

type Recommendation = {
  volunteer: { id: string; name: string; ngoId: string };
  score: number;
  distanceKm: number;
  matchedSkills: string[];
  isCrossNgo: boolean;
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

  const isOwn = !viewerNgoId || need.ngo.id === viewerNgoId;

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
    <li className="group relative overflow-hidden rounded-lg border border-white/5 bg-surface-container/60 p-4 transition-all hover:border-primary-container/30 hover:bg-surface-container">
      <div className="absolute inset-y-0 left-0 w-[2px] origin-top scale-y-0 bg-primary-container transition-transform duration-300 group-hover:scale-y-100" />

      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/5 bg-surface-container-low text-xl">
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
              <Chip className="border border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200">
                from {need.ngo.name}
              </Chip>
            )}
          </div>

          <p className="mt-3 text-sm text-on-surface">{need.rawText}</p>

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
              disabled={pending || need.status !== "OPEN"}
              className="btn-primary !px-4 !py-2 !text-[11px]"
            >
              Find Match
            </button>
            <button
              onClick={toggleShare}
              disabled={pending}
              className="btn-ghost !px-4 !py-2 !text-[11px]"
            >
              {need.isShared ? "Unshare" : "Share"}
            </button>
          </div>
        )}
      </div>

      {matchError && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          <span className="text-amber-300">⚠</span>
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
                <span className="heading text-base font-semibold text-emerald-100">
                  {matchResult.details.volunteer.name}
                </span>
                <span className="label-caps text-emerald-300">Matched</span>
              </div>
              <span className="mono-data rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-emerald-100">
                {matchResult.details.score}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-200/80">
              <span>◎ {matchResult.details.distanceKm} km</span>
              <span>⟐ {matchResult.details.matchedSkills.length} skills</span>
              {matchResult.details.isCrossNgo && (
                <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-2 py-0.5 text-fuchsia-200">
                  ◉ Cross-NGO
                </span>
              )}
            </div>
          </div>

          {matchResult.recommendations.length > 1 && (
            <div className="rounded-md border border-white/5 bg-surface-container-low/60 p-4">
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
                    className="flex items-center justify-between gap-3 rounded border border-white/5 bg-surface-container/40 px-3 py-2 text-xs hover:border-primary-container/30"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="mono-data w-7 text-center text-on-surface-variant">
                        #{i + 2}
                      </span>
                      <span className="truncate text-sm font-medium text-on-surface">
                        {r.volunteer.name}
                      </span>
                      {r.isCrossNgo && (
                        <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-1.5 py-0.5 text-[10px] text-fuchsia-200">
                          ◉ x-NGO
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-on-surface-variant">
                      <span className="mono-data">{r.distanceKm} km</span>
                      <span className="mono-data">{r.matchedSkills.length} sk</span>
                      <span className="mono-data rounded border border-white/10 bg-surface-container-low px-2 py-0.5 text-primary-container">
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
        <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
          <span className="label-caps text-surface-tint">Existing Match</span>
          <span className="mono-data text-primary-container">
            score {need.matches[0].score}
          </span>
          {need.matches[0].isCrossNgo && (
            <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-1.5 py-0.5 text-[10px] text-fuchsia-200">
              ◉ Cross-NGO
            </span>
          )}
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
