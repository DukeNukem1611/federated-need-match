// GET    /api/needs/:id   → fetch a single need with relations
// PATCH  /api/needs/:id   → update isShared and/or status (used by share toggle)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NeedStatus } from "@prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const need = await prisma.reportedNeed.findUnique({
    where: { id: params.id },
    include: {
      ngo: true,
      requiredSkills: { include: { skill: true } },
      matches: { include: { volunteer: { include: { ngo: true } } } },
    },
  });
  if (!need) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ need });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json();
    const data: { isShared?: boolean; status?: NeedStatus } = {};
    if (typeof body.isShared === "boolean") data.isShared = body.isShared;
    if (typeof body.status === "string")    data.status   = body.status as NeedStatus;

    const need = await prisma.reportedNeed.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json({ need });
  } catch (err) {
    console.error("[need:patch] failed:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
