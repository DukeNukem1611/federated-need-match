// GET   /api/incidents/:id  — full incident with timeline + linked needs
// PATCH /api/incidents/:id  — update status (e.g. resolve)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IncidentStatus } from "@prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
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
