// GET  /api/incidents               — list incidents (filterable by status)
// POST /api/incidents               — file a new incident (any NGO can author)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IncidentCategory, IncidentStatus } from "@prisma/client";
import { notifyAllUsersOfIncident } from "@/services/notifications/notify";
import { geocodePlace } from "@/services/ingestion/geocode";
import { requireUser, requireViewer } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireViewer(req);
  if ("error" in auth) return auth.error;

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
    // Must be a signed-in user. The incident is always filed as the user's own
    // NGO — the client can't spoof another NGO (the earlier "lock" was cosmetic).
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const body = await req.json();
    const {
      title, category, locationLabel, latitude, longitude,
      radiusKm, description,
    } = body;
    const createdByNgoId = auth.session.ngoId;

    if (!title || !category || !locationLabel) {
      return NextResponse.json(
        { error: "title, category, and locationLabel are required" },
        { status: 400 },
      );
    }

    if (!Object.values(IncidentCategory).includes(category)) {
      return NextResponse.json({ error: `category must be one of ${Object.values(IncidentCategory).join(", ")}` }, { status: 400 });
    }

    // Resolve coordinates: use explicit lat/lng when the client supplied them
    // (coords mode / "Use Current Location"), otherwise geocode the place label
    // server-side via the shared geocoder (same path ingested needs use).
    let lat = latitude;
    let lng = longitude;
    if (lat == null || lng == null) {
      const geo = await geocodePlace(locationLabel);
      if (!geo) {
        return NextResponse.json(
          {
            error: `We couldn't find "${locationLabel}" on the map. Try a broader area (e.g. a town or city name) or switch to "Provide Coordinates Instead".`,
          },
          { status: 422 },
        );
      }
      lat = geo.lat;
      lng = geo.lng;
    }

    const incident = await prisma.incident.create({
      data: {
        title,
        category,
        locationLabel,
        latitude:  lat,
        longitude: lng,
        radiusKm: radiusKm ?? 2,
        description: description ?? null,
        createdByNgoId,
      },
      include: { createdByNgo: { select: { id: true, name: true } } },
    });

    // Fan a notification out to every user. Don't let a notification failure
    // fail the incident creation itself — log and continue.
    let notified = 0;
    try {
      notified = await notifyAllUsersOfIncident(incident);
    } catch (notifyErr) {
      console.error("[incidents.create] notification fan-out failed:", notifyErr);
    }

    return NextResponse.json({ incident, notified }, { status: 201 });
  } catch (err) {
    console.error("[incidents.create] failed:", err);
    return NextResponse.json({ error: "Failed to create incident" }, { status: 500 });
  }
}
