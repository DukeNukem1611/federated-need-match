// GET /api/ngos/:ngoId/export — the NGO's needs as a CSV download, for
// offline coordination meetings. Any member of the NGO (or the super-admin)
// may export; photo bytes are deliberately excluded.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/admin-auth";
import { requireNgoMember } from "@/lib/api-auth";

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  // Quote when the value contains a delimiter, quote, or newline.
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { ngoId: string } },
) {
  const { ngoId } = params;
  if (!isAdminRequest(req)) {
    const auth = await requireNgoMember(req, ngoId);
    if ("error" in auth) return auth.error;
  }

  const [ngo, needs] = await Promise.all([
    prisma.nGO.findUnique({ where: { id: ngoId }, select: { slug: true } }),
    prisma.reportedNeed.findMany({
      where: { ngoId },
      orderBy: { createdAt: "desc" },
      include: {
        requiredSkills: { include: { skill: { select: { name: true } } } },
        matches: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { volunteer: { select: { name: true } } },
        },
      },
    }),
  ]);
  if (!ngo) {
    return NextResponse.json({ error: "NGO not found" }, { status: 404 });
  }

  const header = [
    "created_at", "status", "urgency", "category", "report",
    "location", "latitude", "longitude", "people_affected", "shared",
    "required_skills", "assigned_volunteer", "match_status", "resolved_at",
  ];
  const rows = needs.map(n => [
    n.createdAt.toISOString(),
    n.status,
    n.urgency,
    n.category,
    n.rawText,
    n.locationLabel ?? "",
    n.latitude,
    n.longitude,
    n.peopleAffected ?? "",
    n.isShared ? "yes" : "no",
    n.requiredSkills.map(s => s.skill.name).join("; "),
    n.matches[0]?.volunteer?.name ?? "",
    n.matches[0]?.status ?? "",
    n.resolvedAt?.toISOString() ?? "",
  ]);

  const csv = [header, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
  const date = new Date().toISOString().slice(0, 10);

  // BOM so Excel opens the UTF-8 CSV with correct characters.
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ngo.slug}-needs-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
