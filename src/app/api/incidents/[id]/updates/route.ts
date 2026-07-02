// POST /api/incidents/:id/updates
// Append a timeline entry to an incident. Any *signed-in* NGO member can post
// — that's the whole point of the shared knowledge base — but the posting
// identity comes from the session, never from the request body.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateKind } from "@prisma/client";
import { requireViewer } from "@/lib/api-auth";
import { validatePhoto } from "@/lib/validation";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireViewer(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { kind, body: text, latitude, longitude } = body;

    // Members always post as their own NGO/user. The super-admin has no NGO,
    // so they may name one explicitly.
    const ngoId: string | undefined = auth.session?.ngoId ?? body.ngoId;
    const authorId: string | null = auth.session?.uid ?? null;

    // A photo may stand alone (body is then an optional caption).
    const photoData = validatePhoto(body.photoData);
    if (photoData === undefined) {
      return NextResponse.json(
        { error: "photoData must be an inline image (jpeg/png/webp/gif) under ~1.5 MB" },
        { status: 400 },
      );
    }

    if (!ngoId || !kind || (!text?.trim() && !photoData)) {
      return NextResponse.json(
        { error: "ngoId, kind, and a body or photo are required" },
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
          authorId,
          kind,
          body: text?.trim() ?? "",
          photoData,
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
