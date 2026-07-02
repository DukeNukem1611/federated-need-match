// GET    /api/incidents/:id  — full incident with timeline + linked needs
// PATCH  /api/incidents/:id  — update status (e.g. resolve)
// DELETE /api/incidents/:id  — super-admin removes the incident + its timeline
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IncidentStatus } from "@prisma/client";
import { isAdminRequest } from "@/lib/admin-auth";
import { requireViewer } from "@/lib/api-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireViewer(req);
  if ("error" in auth) return auth.error;

  const incident = await prisma.incident.findUnique({
    where: { id: params.id },
    include: {
      createdByNgo: { select: { id: true, name: true, slug: true } },
      updates: {
        orderBy: { createdAt: "desc" },
        include: {
          ngo:    { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, name: true } },
        },
      },
      needs: {
        orderBy: { createdAt: "desc" },
        include: {
          ngo: { select: { id: true, name: true } },
          requiredSkills: { include: { skill: true } },
          matches: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!incident) {
    return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  }
  return NextResponse.json({ incident });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // Any signed-in member (or the super-admin) may change status — it's a
  // federation-wide action, and the accompanying timeline entry records who.
  const auth = await requireViewer(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { status } = body as { status?: IncidentStatus };

    if (!status || !Object.values(IncidentStatus).includes(status)) {
      return NextResponse.json(
        { error: `status must be one of ${Object.values(IncidentStatus).join(", ")}` },
        { status: 400 },
      );
    }

    const incident = await prisma.incident.update({
      where: { id: params.id },
      data: {
        status,
        resolvedAt: status === "RESOLVED" ? new Date() : null,
      },
    });
    return NextResponse.json({ incident });
  } catch (err) {
    console.error("[incidents.patch] failed:", err);
    return NextResponse.json({ error: "Failed to update incident" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  // Removing an incident is a super-admin action.
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  try {
    const incident = await prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { incidentId: id } }),
      prisma.incidentUpdate.deleteMany({ where: { incidentId: id } }),
      // Keep the NGOs' needs — just unlink them from the incident.
      prisma.reportedNeed.updateMany({ where: { incidentId: id }, data: { incidentId: null } }),
      // Detach any volunteer flagged as deployed to this incident.
      prisma.user.updateMany({ where: { activeIncidentId: id }, data: { activeIncidentId: null } }),
      prisma.incident.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[incidents.delete] failed:", err);
    return NextResponse.json({ error: "Failed to remove incident" }, { status: 500 });
  }
}
