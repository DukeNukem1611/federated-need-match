// POST /api/ingest
// Accepts unstructured field text + reporter context; returns a persisted
// ReportedNeed with the parser's structured fields.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseUnstructuredText } from "@/services/ingestion/parser";

export async function POST(req: NextRequest) {
  try {
    const { ngoId, rawText, reporterLat, reporterLng, isShared } = await req.json();

    if (!ngoId || !rawText) {
      return NextResponse.json(
        { error: "ngoId and rawText are required" },
        { status: 400 },
      );
    }

    // 1. Unstructured → structured (mocked LLM).
    const parsed = await parseUnstructuredText(rawText);

    // 2. Parser doesn't geocode in MVP — fall back to reporter coords.
    const lat = parsed.latitude  ?? reporterLat;
    const lng = parsed.longitude ?? reporterLng;
    if (lat == null || lng == null) {
      return NextResponse.json(
        { error: "Could not determine location (provide reporterLat/reporterLng)" },
        { status: 422 },
      );
    }

    // 3. Resolve skill names → ids, upserting missing ones so the hackathon
    //    demo never fails on unseeded skills.
    const skillIds = await Promise.all(
      parsed.requiredSkills.map(async name => {
        const s = await prisma.skill.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        return s.id;
      }),
    );

    // 4. Persist.
    const need = await prisma.reportedNeed.create({
      data: {
        ngoId,
        rawText,
        category: parsed.category,
        urgency:  parsed.urgency,
        locationLabel: parsed.locationLabel,
        latitude:  lat,
        longitude: lng,
        peopleAffected: parsed.peopleAffected ?? 1,
        isShared: Boolean(isShared),
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
