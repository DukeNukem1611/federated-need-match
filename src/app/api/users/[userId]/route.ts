// PATCH  /api/users/:userId — edit a helper (name/email/status/position and,
//                             optionally, a full replacement of their skills).
// DELETE /api/users/:userId — remove a helper. A User is referenced by several
//                             RESTRICT relations, so we clear those first (and
//                             null out authored incident updates to preserve
//                             the timeline) before deleting the row.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, VolunteerStatus } from "@prisma/client";
import { isValidEmail, validatePhoto } from "@/lib/validation";
import { isAdminRequest } from "@/lib/admin-auth";
import { requireUser, requireNgoAdmin } from "@/lib/api-auth";

// Skill proficiency is a 1–5 scale; clamp and default to 3.
function clampLevel(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, Math.round(n)));
}

const STATUSES: VolunteerStatus[] = ["AVAILABLE", "BUSY", "OFFLINE"];

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const { userId } = params;
  try {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json({ error: "Helper not found" }, { status: 404 });
    }

    // The owner may edit themselves (status / deployment); the NGO's admin (or
    // super-admin) may edit any member of their NGO.
    if (!isAdminRequest(req)) {
      const auth = await requireUser(req);
      if ("error" in auth) return auth.error;
      const s = auth.session;
      const allowed = s.uid === userId || (s.role === "ADMIN" && s.ngoId === existing.ngoId);
      if (!allowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await req.json();
    const {
      name, email, status, latitude, longitude, maxRadiusKm, skills,
      activeIncidentId, activeNeedId,
    } = body;

    if (typeof email === "string" && email.trim() && !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    const data: Prisma.UserUpdateInput = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (typeof email === "string" && email.trim()) data.email = email.trim().toLowerCase();
    if (typeof status === "string" && STATUSES.includes(status as VolunteerStatus)) {
      data.status = status as VolunteerStatus;
    }
    if ("latitude" in body) data.latitude = numOrNull(latitude);
    if ("longitude" in body) data.longitude = numOrNull(longitude);
    if ("maxRadiusKm" in body) data.maxRadiusKm = numOrNull(maxRadiusKm);

    // Profile picture: null clears it; anything else must be a valid inline image.
    if ("avatarData" in body) {
      const avatar = validatePhoto(body.avatarData);
      if (avatar === undefined) {
        return NextResponse.json(
          { error: "avatarData must be an inline image (jpeg/png/webp/gif) under ~1.5 MB" },
          { status: 400 },
        );
      }
      data.avatarData = avatar;
    }

    // Self-reported deployment. A falsy value clears it (disconnect); a string
    // id connects to that incident/need.
    if ("activeIncidentId" in body) {
      data.activeIncident = activeIncidentId
        ? { connect: { id: activeIncidentId } }
        : { disconnect: true };
    }
    if ("activeNeedId" in body) {
      data.activeNeed = activeNeedId
        ? { connect: { id: activeNeedId } }
        : { disconnect: true };
    }

    // When `skills` is provided, replace the helper's skill set wholesale so
    // the edit form is the single source of truth.
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    if (Array.isArray(skills)) {
      const rows = skills
        .filter((s: any) => s && typeof s.skillId === "string")
        .map((s: any) => ({ userId, skillId: s.skillId, level: clampLevel(s.level) }));
      ops.push(prisma.volunteerSkill.deleteMany({ where: { userId } }));
      if (rows.length) ops.push(prisma.volunteerSkill.createMany({ data: rows }));
    }
    ops.push(prisma.user.update({ where: { id: userId }, data }));
    await prisma.$transaction(ops);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { skills: { include: { skill: true } } },
    });
    return NextResponse.json({ user });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "A user with that email already exists." },
        { status: 409 },
      );
    }
    console.error("[users.update] failed:", err);
    return NextResponse.json({ error: "Failed to update helper" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const { userId } = params;
  try {
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json({ error: "Helper not found" }, { status: 404 });
    }

    // Only the NGO's admin (or super-admin) may remove a member.
    if (!isAdminRequest(req)) {
      const auth = await requireNgoAdmin(req, existing.ngoId);
      if ("error" in auth) return auth.error;
    }

    await prisma.$transaction([
      prisma.volunteerSkill.deleteMany({ where: { userId } }),
      prisma.match.deleteMany({ where: { volunteerId: userId } }),
      prisma.notification.deleteMany({ where: { userId } }),
      // Keep the incident timeline intact — drop only the author link.
      prisma.incidentUpdate.updateMany({ where: { authorId: userId }, data: { authorId: null } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[users.delete] failed:", err);
    return NextResponse.json({ error: "Failed to delete helper" }, { status: 500 });
  }
}
