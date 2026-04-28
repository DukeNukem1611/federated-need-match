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
  if (need.status !== "OPEN") return [];

  const requiredSkillIds = need.requiredSkills.map(s => s.skillId);

  // Step 1 — own NGO pool.
  let candidates = await queryCandidates(
    { ngoId: need.ngoId },
    requiredSkillIds,
  );
  let isCrossNgoSearch = false;

  // Step 2 — federated fallback (only when the need is opted-in to sharing).
  if (candidates.length === 0 && need.isShared) {
    candidates = await queryCandidates(
      {
        ngoId: { not: need.ngoId },
        ngo:   { sharesPool: true },
      },
      requiredSkillIds,
    );
    isCrossNgoSearch = true;
  }

  if (candidates.length === 0) return [];

  // Step 3 — score, rank, slice to K.
  return candidates
    .map(v => scoreCandidate(v, need, requiredSkillIds, isCrossNgoSearch))
    .filter(s => s.score > 0)            // out-of-radius candidates are dropped
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

  // Linear proximity decay; out of radius = hard reject.
  let distanceKm = Infinity;
  let proximityScore = 0;
  if (volunteer.latitude != null && volunteer.longitude != null) {
    distanceKm = haversineKm(
      volunteer.latitude, volunteer.longitude,
      need.latitude, need.longitude,
    );
    const maxR = volunteer.maxRadiusKm ?? 15;
    proximityScore = distanceKm <= maxR
      ? WEIGHTS.proximity * (1 - distanceKm / maxR)
      : 0;
  }

  if (proximityScore === 0 && distanceKm !== 0) {
    return { volunteer, score: 0, distanceKm, matchedSkills: [], isCrossNgo };
  }

  const sameNgoScore = isCrossNgo ? 0 : WEIGHTS.sameNgo;
  const urgencyScore = WEIGHTS.urgencyBoost * URGENCY_MULTIPLIER[need.urgency];

  return {
    volunteer,
    score: Number((skillScore + proximityScore + sameNgoScore + urgencyScore).toFixed(2)),
    distanceKm: Number(distanceKm.toFixed(2)),
    matchedSkills: matched.map(m => m.skillId),
    isCrossNgo,
  };
}

// Convenience wrapper: rank the top K, persist the top pick as the official
// Match, and return the full ranked list so callers can show alternates.
export async function matchAndPersist(needId: string, k: number = 5) {
  const ranked = await findTopVolunteersForNeed(needId, k);
  if (ranked.length === 0) return null;
  const best = ranked[0];

  return prisma.$transaction(async tx => {
    const match = await tx.match.create({
      data: {
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
}
