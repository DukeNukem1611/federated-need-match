// GET /api/volunteers?ngoId=...
// Lists volunteers (optionally scoped to one NGO) with their skills + status.
// Used by the dashboard's volunteer panel so the demo can show the available
// pool side-by-side with the needs.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireViewer(req);
  if ("error" in auth) return auth.error;

  const ngoId = new URL(req.url).searchParams.get("ngoId") ?? undefined;

  const volunteers = await prisma.user.findMany({
    where: { role: "VOLUNTEER", ...(ngoId ? { ngoId } : {}) },
    include: {
      ngo: { select: { id: true, name: true } },
      skills: { include: { skill: true } },
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ volunteers });
}
