// GET /api/updates/:id/photo — an incident-update's attached photo as a real
// image response (see /api/needs/[id]/photo for why).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/api-auth";
import { dataUrlToImageResponse } from "@/lib/photo-response";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireViewer(req);
  if ("error" in auth) return auth.error;

  const update = await prisma.incidentUpdate.findUnique({
    where: { id: params.id },
    select: { photoData: true },
  });
  if (!update?.photoData) {
    return NextResponse.json({ error: "No photo" }, { status: 404 });
  }
  return dataUrlToImageResponse(update.photoData);
}
