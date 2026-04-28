// GET  /api/incidents               — list incidents (filterable by status)
// POST /api/incidents               — file a new incident (any NGO can author)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IncidentCategory, IncidentStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") as IncidentStatus | null;
  const ngoId  = req.nextUrl.searchParams.get("ngoId");

  const incidents = await prisma.incident.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(ngoId  ? { OR: [{ createdByNgoId: ngoId }, { updates: { some: { ngoId } } }] } : {}),
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      createdByNgo: { select: { id: true, name: true, slug: true } },
      _count: { select: { updates: true, needs: true } },
    },
  });

  return NextResponse.json({ incidents });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title, category, locationLabel, latitude, longitude,
      radiusKm, description, createdByNgoId,
    } = body;

    if (!title || !category || !locationLabel || latitude == null || longitude == null || !createdByNgoId) {
      return NextResponse.json(
        { error: "title, category, locationLabel, latitude, longitude, createdByNgoId are required" },
        { status: 400 },
      );
    }

    if (!Object.values(IncidentCategory).includes(category)) {
      return NextResponse.json({ error: `category must be one of ${Object.values(IncidentCategory).join(", ")}` }, { status: 400 });
    }

    const incident = await prisma.incident.create({
      data: {
        title,
        category,
        locationLabel,
        latitude,
        longitude,
        radiusKm: radiusKm ?? 2,
        description: description ?? null,
        createdByNgoId,
      },
      include: { createdByNgo: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ incident }, { status: 201 });
  } catch (err) {
    console.error("[incidents.create] failed:", err);
    return NextResponse.json({ error: "Failed to create incident" }, { status: 500 });
  }
}
