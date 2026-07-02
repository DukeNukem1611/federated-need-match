// GET /api/needs/:id/photo — the need's attached field photo as a real image
// response. Lists send only a hasPhoto flag; the browser fetches the bytes
// here once and caches them, instead of re-downloading base64 blobs inside
// every polled page refresh.
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

  const need = await prisma.reportedNeed.findUnique({
    where: { id: params.id },
    select: { photoData: true },
  });
  if (!need?.photoData) {
    return NextResponse.json({ error: "No photo" }, { status: 404 });
  }
  return dataUrlToImageResponse(need.photoData);
}
