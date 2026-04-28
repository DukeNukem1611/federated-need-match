// GET /api/needs
// List needs. Use ?ngoId=... to scope to a single NGO, or ?shared=true to
// show all needs that the federation can see.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ngoId  = searchParams.get("ngoId") ?? undefined;
  const shared = searchParams.get("shared") === "true";

  const needs = await prisma.reportedNeed.findMany({
    where: shared ? { isShared: true } : ngoId ? { ngoId } : undefined,
    include: {
      ngo: { select: { id: true, name: true } },
      requiredSkills: { include: { skill: true } },
      matches: true,
    },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ needs });
}
