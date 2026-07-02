// Cross-NGO volunteer matcher.
//
// Scoring is a transparent weighted sum so judges can read it at a glance.
// Strategy:
//   1. Prefer volunteers from the reporting NGO.
//   2. Fall back to the federated network only when the need is shared.
//   3. Score every candidate; return the best (or null).
import { ReportedNeed, User, VolunteerStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/services/geo/distance";
import { notifyVolunteersOfRecommendation } from "@/services/notifications/notify";

const WEIGHTS = {
  skill:        50,  // wrong skill = wrong person
  proximity:    30,  // closer is better, capped at maxRadiusKm
  sameNgo:      15,  // small bonus for the owning NGO's own volunteers
  urgencyBoost:  5,  // nudge for critical needs
};

const URGENCY_MULTIPLIER = {
  LOW: 0.5, MEDIUM: 0.8, HIGH: 1.0, CRITICAL: 1.3,
} as const;

type VolunteerWithSkills = User & {
  skills: { skillId: string; level: number }[];
};

export type ScoredVolunteer = {
  volunteer: VolunteerWithSkills;
  score: number;
  distanceKm: number;
  matchedSkills: string[];
  isCrossNgo: boolean;
  // True when the volunteer is farther than their preferred travel radius (or
  // has no known location). They are still surfaced — ranked below in-radius
  // candidates — so a distant need never silently matches no one.
  outOfRange: boolean;
};

export async function findTopVolunteersForNeed(
  needId: string,
  k: number = 5,
): Promise<ScoredVolunteer[]> {
  const need = await prisma.reportedNeed.findUnique({
    where: { id: needId },
    include: { requiredSkills: true },
  });
  if (!need) throw new Error(`Need ${needId} not found`);
  // Rankable while the need is live — including after an initial match — so the
  // recommendations can be refreshed. Only a closed need is excluded.
  if (need.status === "RESOLVED" || need.status === "CANCELLED") return [];

  const requiredSkillIds = need.requiredSkills.map(s => s.skillId);

  // Volunteers who already declined this need stay out of future rankings —
  // re-proposing them would just bounce.
  const declined = await prisma.match.findMany({
    where: { needId, status: "DECLINED" },
    select: { volunteerId: true },
  });
  const declinedIds = new Set(declined.map(d => d.volunteerId));

  // Own-NGO pool, plus — when the need is shared — the federated pool from any
  // other pool-sharing NGO. We score the union and let the same-NGO bonus keep
  // local volunteers preferred in the ranking, rather than short-circuiting the
  // network search whenever the owning NGO has any candidate at all.
  const ownPool = await queryCandidates({ ngoId: need.ngoId }, requiredSkillIds);
  const federatedPool = need.isShared
    ? await queryCandidates(
        { ngoId: { not: need.ngoId }, ngo: { sharesPool: true } },
        requiredSkillIds,
      )
    : [];

  const candidates = [...ownPool, ...federatedPool].filter(
    v => !declinedIds.has(v.id),
  );
  if (candidates.length === 0) return [];

  // Score, rank, slice to K. `isCrossNgo` is derived per-candidate from its NGO.
  return candidates
    .map(v => scoreCandidate(v, need, requiredSkillIds, v.ngoId !== need.ngoId))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, k));
}

export async function findBestVolunteerForNeed(
  needId: string,
): Promise<ScoredVolunteer | null> {
  const [top] = await findTopVolunteersForNeed(needId, 1);
  return top ?? null;
}

async function queryCandidates(
  ngoFilter: object,
  requiredSkillIds: string[],
): Promise<VolunteerWithSkills[]> {
  return prisma.user.findMany({
    where: {
      role: "VOLUNTEER",
      status: VolunteerStatus.AVAILABLE,
      ...ngoFilter,
      skills: requiredSkillIds.length
        ? { some: { skillId: { in: requiredSkillIds } } }
        : undefined,
    },
    include: { skills: true },
  });
}

function scoreCandidate(
  volunteer: VolunteerWithSkills,
  need: ReportedNeed,
  requiredSkillIds: string[],
  isCrossNgo: boolean,
): ScoredVolunteer {
  // Skill coverage × average proficiency of matched skills (normalized to 0–1).
  const matched = volunteer.skills.filter(s => requiredSkillIds.includes(s.skillId));
  const coverage = requiredSkillIds.length
    ? matched.length / requiredSkillIds.length
    : 1;
  const avgLevel = matched.length
    ? matched.reduce((a, s) => a + s.level, 0) / matched.length / 5
    : 0;
  const skillScore = WEIGHTS.skill * coverage * (0.6 + 0.4 * avgLevel);

  // Linear proximity decay within the volunteer's preferred radius. Beyond it
  // (or with no known location) the proximity bonus is simply 0 — the candidate
  // is NOT rejected, so skills + urgency still earn a positive score and a
  // distant need can still match the best available people, ranked lower.
  let distanceKm = Infinity;
  let proximityScore = 0;
  let outOfRange = true;
  if (volunteer.latitude != null && volunteer.longitude != null) {
    distanceKm = haversineKm(
      volunteer.latitude, volunteer.longitude,
      need.latitude, need.longitude,
    );
    const maxR = volunteer.maxRadiusKm ?? 15;
    if (distanceKm <= maxR) {
      proximityScore = WEIGHTS.proximity * (1 - distanceKm / maxR);
      outOfRange = false;
    }
  }

  const sameNgoScore = isCrossNgo ? 0 : WEIGHTS.sameNgo;
  const urgencyScore = WEIGHTS.urgencyBoost * URGENCY_MULTIPLIER[need.urgency];

  return {
    volunteer,
    score: Number((skillScore + proximityScore + sameNgoScore + urgencyScore).toFixed(2)),
    distanceKm: Number(distanceKm.toFixed(2)),
    matchedSkills: matched.map(m => m.skillId),
    isCrossNgo,
    outOfRange,
  };
}

// Convenience wrapper: rank the top K, persist the top pick as the official
// Match, and return the full ranked list so callers can show alternates.
export async function matchAndPersist(needId: string, k: number = 5) {
  const ranked = await findTopVolunteersForNeed(needId, k);
  if (ranked.length === 0) return null;
  const best = ranked[0];

  const result = await prisma.$transaction(async tx => {
    // Re-runnable: clear prior auto-proposals for other volunteers (keeping any
    // human-progressed matches), then upsert the current best so clicking
    // "Find Match" again just refreshes the official pick instead of failing on
    // the (needId, volunteerId) unique constraint.
    await tx.match.deleteMany({
      where: { needId, status: "PROPOSED", volunteerId: { not: best.volunteer.id } },
    });
    const match = await tx.match.upsert({
      where: { needId_volunteerId: { needId, volunteerId: best.volunteer.id } },
      update: { score: best.score, isCrossNgo: best.isCrossNgo },
      create: {
        needId,
        volunteerId: best.volunteer.id,
        score: best.score,
        isCrossNgo: best.isCrossNgo,
      },
    });
    await tx.reportedNeed.update({
      where: { id: needId },
      data: { status: "MATCHED" },
    });
    return { match, details: best, recommendations: ranked };
  });

  // Best-effort: ping the recommended (non-BUSY) volunteers. A notification
  // failure must never fail the match itself.
  try {
    const need = await prisma.reportedNeed.findUnique({
      where: { id: needId },
      select: { id: true, rawText: true, incidentId: true, ngo: { select: { name: true } } },
    });
    if (need) {
      await notifyVolunteersOfRecommendation(
        { id: need.id, rawText: need.rawText, ngoName: need.ngo.name, incidentId: need.incidentId },
        ranked.map(r => r.volunteer.id),
      );
    }
  } catch (notifyErr) {
    console.error("[match] recommendation notify failed:", notifyErr);
  }

  return result;
}
