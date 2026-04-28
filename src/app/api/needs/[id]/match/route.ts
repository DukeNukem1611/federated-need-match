// POST /api/needs/:id/match
// Ranks the top K candidates, persists the top pick as the Match, and
// returns the full ranked list so the UI can show alternates.
import { NextRequest, NextResponse } from "next/server";
import { matchAndPersist } from "@/services/matching/matcher";

const DEFAULT_K = 5;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const kParam = req.nextUrl.searchParams.get("k");
    const k = kParam ? Math.max(1, Math.min(20, parseInt(kParam, 10) || DEFAULT_K)) : DEFAULT_K;

    const result = await matchAndPersist(params.id, k);
    if (!result) {
      return NextResponse.json(
        { error: "No suitable volunteer found", needId: params.id },
        { status: 404 },
      );
    }
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[match] failed:", err);
    return NextResponse.json({ error: "Match failed" }, { status: 500 });
  }
}
