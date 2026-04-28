// POST /api/incidents/:id/updates
// Append a timeline entry to an incident. Any NGO can post an update —
// that's the whole point of the shared knowledge base.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateKind } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const { ngoId, authorId, kind, body: text, latitude, longitude } = body;

    if (!ngoId || !kind || !text?.trim()) {
      return NextResponse.json(
        { error: "ngoId, kind, and body are required" },
        { status: 400 },
      );
    }
    if (!Object.values(UpdateKind).includes(kind)) {
      return NextResponse.json(
        { error: `kind must be one of ${Object.values(UpdateKind).join(", ")}` },
        { status: 400 },
      );
    }

    const incident = await prisma.incident.findUnique({ where: { id: params.id } });
    if (!incident) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    // Touch updatedAt on the incident so the index orders by recency.
    const [update] = await prisma.$transaction([
      prisma.incidentUpdate.create({
        data: {
          incidentId: params.id,
          ngoId,
          authorId: authorId ?? null,
          kind,
          body: text.trim(),
          latitude: latitude ?? null,
          longitude: longitude ?? null,
        },
        include: {
          ngo:    { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, name: true } },
        },
      }),
      prisma.incident.update({
        where: { id: params.id },
        data: { updatedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ update }, { status: 201 });
  } catch (err) {
    console.error("[incidents.updates.post] failed:", err);
    return NextResponse.json({ error: "Failed to post update" }, { status: 500 });
  }
}
