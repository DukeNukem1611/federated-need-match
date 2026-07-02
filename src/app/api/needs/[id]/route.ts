// GET    /api/needs/:id   → fetch a single need with relations
// PATCH  /api/needs/:id   → update isShared and/or status (used by share toggle)
// DELETE /api/needs/:id   → remove a need (owning NGO's members), e.g. once fulfilled
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NeedStatus } from "@prisma/client";
import { requireNgoMember } from "@/lib/api-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const need = await prisma.reportedNeed.findUnique({
    where: { id: params.id },
    include: {
      ngo: true,
      requiredSkills: { include: { skill: true } },
      matches: { include: { volunteer: { include: { ngo: true } } } },
    },
  });
  if (!need) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ need });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Only the owning NGO's members may toggle share / change status.
    const existing = await prisma.reportedNeed.findUnique({
      where: { id: params.id },
      select: { ngoId: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const auth = await requireNgoMember(req, existing.ngoId);
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const data: { isShared?: boolean; status?: NeedStatus; resolvedAt?: Date | null } = {};
    if (typeof body.isShared === "boolean") data.isShared = body.isShared;
    if (typeof body.status === "string") {
      data.status = body.status as NeedStatus;
      // Track when the need was closed out; clear the stamp if it reopens.
      data.resolvedAt = data.status === "RESOLVED" ? new Date() : null;
    }

    const need = await prisma.reportedNeed.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ need });
  } catch (err) {
    console.error("[need:patch] failed:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const existing = await prisma.reportedNeed.findUnique({
      where: { id: params.id },
      select: { ngoId: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Any member of the owning NGO (admin or volunteer) may remove the need.
    const auth = await requireNgoMember(req, existing.ngoId);
    if ("error" in auth) return auth.error;

    // Clear dependent rows first (matches + required-skill links), and detach
    // any volunteer who flagged this need as their active deployment.
    await prisma.$transaction([
      prisma.match.deleteMany({ where: { needId: params.id } }),
      prisma.needSkill.deleteMany({ where: { needId: params.id } }),
      prisma.user.updateMany({
        where: { activeNeedId: params.id },
        data: { activeNeedId: null },
      }),
      prisma.reportedNeed.delete({ where: { id: params.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[need:delete] failed:", err);
    return NextResponse.json({ error: "Failed to remove need" }, { status: 500 });
  }
}
