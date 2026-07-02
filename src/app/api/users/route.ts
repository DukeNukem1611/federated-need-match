// GET  /api/users?ngoId=&role=  — list users (optionally scoped by NGO/role).
// POST /api/users               — an NGO adds a helper (volunteer) or admin.
//                                 Optional location + skills make the new
//                                 helper immediately matchable.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { isValidEmail } from "@/lib/validation";
import { isAdminRequest } from "@/lib/admin-auth";
import { requireNgoAdmin } from "@/lib/api-auth";
import { hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const ngoId = req.nextUrl.searchParams.get("ngoId") ?? undefined;
  const role  = req.nextUrl.searchParams.get("role") as UserRole | null;

  const users = await prisma.user.findMany({
    where: {
      ...(ngoId ? { ngoId } : {}),
      ...(role ? { role } : {}),
    },
    include: {
      ngo:    { select: { id: true, name: true } },
      skills: { include: { skill: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ users });
}

// Skill proficiency is a 1–5 scale; clamp anything out of range and default
// to 3 when unspecified (matches the schema default).
function clampLevel(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name, email, ngoId, role,
      latitude, longitude, maxRadiusKm, skillIds, skills,
      password,
    } = body;

    // Only the NGO's own admin (or the super-admin) may add members to it.
    if (!ngoId) {
      return NextResponse.json({ error: "ngoId is required" }, { status: 400 });
    }
    if (!isAdminRequest(req)) {
      const auth = await requireNgoAdmin(req, ngoId);
      if ("error" in auth) return auth.error;
    }

    // Prefer the richer `skills` array (with per-skill levels); fall back to
    // a bare `skillIds` list (all default to level 3) for older callers.
    const skillRows: { skillId: string; level: number }[] = Array.isArray(skills)
      ? skills
          .filter((s: any) => s && typeof s.skillId === "string")
          .map((s: any) => ({ skillId: s.skillId, level: clampLevel(s.level) }))
      : Array.isArray(skillIds)
        ? skillIds.map((skillId: string) => ({ skillId, level: 3 }))
        : [];

    if (!name?.trim() || !email?.trim() || !ngoId) {
      return NextResponse.json(
        { error: "name, email, and ngoId are required" },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    const finalRole: UserRole = role === "ADMIN" ? "ADMIN" : "VOLUNTEER";

    const ngo = await prisma.nGO.findUnique({ where: { id: ngoId } });
    if (!ngo) {
      return NextResponse.json({ error: "NGO not found" }, { status: 404 });
    }

    // A default password the member changes on first login. Generated when the
    // admin doesn't supply one, and returned so it can be shared with them.
    const defaultPassword =
      typeof password === "string" && password.trim().length >= 6
        ? password.trim()
        : Math.random().toString(36).slice(2, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: finalRole,
        ngoId,
        passwordHash: await hashPassword(defaultPassword),
        mustChangePassword: true,
        // Volunteer-only positioning fields.
        ...(finalRole === "VOLUNTEER"
          ? {
              latitude:    latitude != null ? Number(latitude) : null,
              longitude:   longitude != null ? Number(longitude) : null,
              maxRadiusKm: maxRadiusKm != null ? Number(maxRadiusKm) : 15,
            }
          : {}),
        ...(skillRows.length
          ? { skills: { create: skillRows.map(r => ({ skillId: r.skillId, level: r.level })) } }
          : {}),
      },
      include: { skills: { include: { skill: true } } },
    });

    // Surface the default password once so the admin can hand it to the member.
    return NextResponse.json({ user, defaultPassword }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "A user with that email already exists." },
        { status: 409 },
      );
    }
    console.error("[users.create] failed:", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
