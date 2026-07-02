// POST /api/ingest
// Accepts unstructured field text + reporter context; returns a persisted
// ReportedNeed with the parser's structured fields.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseUnstructuredText } from "@/services/ingestion/parser";
import { geocodePlace } from "@/services/ingestion/geocode";
import { requireUser } from "@/lib/api-auth";
import { validatePhoto } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    // Must be signed in; the need is always filed under the user's own NGO.
    const auth = await requireUser(req);
    if ("error" in auth) return auth.error;

    const {
      rawText,
      reporterLat,
      reporterLng,
      isShared,
      incidentId,
      // Optional explicit location chosen by a human (typeahead pick / map pin /
      // coords). When present it wins over anything inferred from the report.
      latitude: explicitLat,
      longitude: explicitLng,
      locationLabel: explicitLabel,
      photoData: rawPhoto,
    } = await req.json();
    const ngoId = auth.session.ngoId;

    if (!rawText) {
      return NextResponse.json(
        { error: "rawText is required" },
        { status: 400 },
      );
    }

    // Optional field photo attached as evidence of the situation.
    const photoData = validatePhoto(rawPhoto);
    if (photoData === undefined) {
      return NextResponse.json(
        { error: "photoData must be an inline image (jpeg/png/webp/gif) under ~1.5 MB" },
        { status: 400 },
      );
    }

    // 1. Unstructured → structured via Gemini.
    const parsed = await parseUnstructuredText(rawText);

    // 2. Resolve coordinates in priority order:
    //    a) explicit coords the user set (typeahead pick / map pin / coords),
    //    b) explicit coords from the parser (rare),
    //    c) geocode a place label — the user-typed one first, else the parser's,
    //    d) fall back to the reporter's coords (incident location / NGO default).
    let lat = explicitLat ?? parsed.latitude;
    let lng = explicitLng ?? parsed.longitude;
    const labelToGeocode =
      (typeof explicitLabel === "string" && explicitLabel.trim()) ||
      parsed.locationLabel;
    if ((lat == null || lng == null) && labelToGeocode) {
      const geo = await geocodePlace(labelToGeocode);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    }
    if (lat == null || lng == null) {
      lat = reporterLat;
      lng = reporterLng;
    }
    if (lat == null || lng == null) {
      return NextResponse.json(
        { error: "Could not determine location (provide reporterLat/reporterLng)" },
        { status: 422 },
      );
    }

    // 3. Resolve skill names → ids, upserting missing ones so the hackathon
    //    demo never fails on unseeded skills.
    const skillIds = await Promise.all(
      parsed.requiredSkills.map(async raw => {
        const name = raw.trim();
        // Match an existing skill case-insensitively so parser variants
        // ("cooking" vs the seeded "Cooking") map to the same Skill row — a
        // mismatch here silently breaks matching (no volunteer has the new id).
        const existing = await prisma.skill.findFirst({
          where: { name: { equals: name, mode: "insensitive" } },
        });
        if (existing) return existing.id;
        const created = await prisma.skill.create({ data: { name } });
        return created.id;
      }),
    );

    // 4. Persist.
    const need = await prisma.reportedNeed.create({
      data: {
        ngoId,
        rawText,
        category: parsed.category,
        urgency:  parsed.urgency,
        locationLabel:
          (typeof explicitLabel === "string" && explicitLabel.trim()) ||
          parsed.locationLabel,
        latitude:  lat,
        longitude: lng,
        peopleAffected: parsed.peopleAffected ?? 1,
        isShared: Boolean(isShared),
        photoData,
        // Optionally attach to a running incident (when filed from its page).
        ...(incidentId ? { incidentId } : {}),
        requiredSkills: { create: skillIds.map(id => ({ skillId: id })) },
      },
      include: { requiredSkills: { include: { skill: true } } },
    });

    return NextResponse.json({ need, parsed }, { status: 201 });
  } catch (err) {
    console.error("[ingest] failed:", err);
    return NextResponse.json({ error: "Ingestion failed" }, { status: 500 });
  }
}
