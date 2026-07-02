// PATCH  /api/ngos/:ngoId — the NGO's admin (or super-admin) updates its
//                           profile (currently: the logo / profile picture).
// DELETE /api/ngos/:ngoId — super-admin removes an NGO and everything it owns.
// Several relations are RESTRICT, so we tear down in dependency order inside a
// transaction (mirrors the user-delete cascade in /api/users/[userId]).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/admin-auth";
import { requireNgoAdmin } from "@/lib/api-auth";
import { validatePhoto } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { ngoId: string } },
) {
  const { ngoId } = params;

  // The NGO's own admin, or the super-admin.
  if (!isAdminRequest(req)) {
    const auth = await requireNgoAdmin(req, ngoId);
    if ("error" in auth) return auth.error;
  }

  try {
    const body = await req.json();

    const data: { logoData?: string | null } = {};
    if ("logoData" in body) {
      const logo = validatePhoto(body.logoData);
      if (logo === undefined) {
        return NextResponse.json(
          { error: "logoData must be an inline image (jpeg/png/webp/gif) under ~1.5 MB" },
          { status: 400 },
        );
      }
      data.logoData = logo;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const ngo = await prisma.nGO.update({ where: { id: ngoId }, data });
    return NextResponse.json({ ngo: { id: ngo.id, name: ngo.name, logoData: ngo.logoData } });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "NGO not found" }, { status: 404 });
    }
    console.error("[ngos.patch] failed:", err);
    return NextResponse.json({ error: "Failed to update NGO" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { ngoId: string } },
) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ngoId } = params;
  try {
    const ngo = await prisma.nGO.findUnique({ where: { id: ngoId } });
    if (!ngo) {
      return NextResponse.json({ error: "NGO not found" }, { status: 404 });
    }

    // Gather the ids we need to clear dependent rows for.
    const [users, needs, incidents] = await Promise.all([
      prisma.user.findMany({ where: { ngoId }, select: { id: true } }),
      prisma.reportedNeed.findMany({ where: { ngoId }, select: { id: true } }),
      prisma.incident.findMany({ where: { createdByNgoId: ngoId }, select: { id: true } }),
    ]);
    const userIds = users.map(u => u.id);
    const needIds = needs.map(n => n.id);
    const incidentIds = incidents.map(i => i.id);

    await prisma.$transaction([
      // Matches reference needs and volunteers belonging to this NGO.
      prisma.match.deleteMany({
        where: { OR: [{ needId: { in: needIds } }, { volunteerId: { in: userIds } }] },
      }),
      // Notifications reference this NGO's users and its incidents.
      prisma.notification.deleteMany({
        where: { OR: [{ userId: { in: userIds } }, { incidentId: { in: incidentIds } }] },
      }),
      // Skills join rows for this NGO's needs + volunteers.
      prisma.needSkill.deleteMany({ where: { needId: { in: needIds } } }),
      prisma.volunteerSkill.deleteMany({ where: { userId: { in: userIds } } }),
      // Detach users from any active deployment so the User delete isn't blocked.
      prisma.user.updateMany({
        where: { ngoId },
        data: { activeIncidentId: null, activeNeedId: null },
      }),
      // Incident updates authored by this NGO (and any on its incidents).
      prisma.incidentUpdate.deleteMany({
        where: { OR: [{ ngoId }, { incidentId: { in: incidentIds } }] },
      }),
      // Needs: this NGO's own, plus any linked to its incidents.
      prisma.reportedNeed.deleteMany({
        where: { OR: [{ ngoId }, { incidentId: { in: incidentIds } }] },
      }),
      prisma.incident.deleteMany({ where: { createdByNgoId: ngoId } }),
      prisma.user.deleteMany({ where: { ngoId } }),
      prisma.nGO.delete({ where: { id: ngoId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[ngos.delete] failed:", err);
    return NextResponse.json({ error: "Failed to delete NGO" }, { status: 500 });
  }
}
