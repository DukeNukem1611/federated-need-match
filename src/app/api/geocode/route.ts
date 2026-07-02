// GET /api/geocode?q=...&limit=5    — forward: text → candidate matches (typeahead)
// GET /api/geocode?lat=..&lng=..    — reverse: coordinates → a label (map pin)
// Both go through the shared geocoder, so suggestions, the map picker, incident
// filing, and need ingestion all agree.
import { NextRequest, NextResponse } from "next/server";
import { searchPlaces, reverseGeocode } from "@/services/ingestion/geocode";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // Reverse lookup when coordinates are supplied.
  const latRaw = params.get("lat");
  const lngRaw = params.get("lng");
  if (latRaw != null && lngRaw != null) {
    const lat = parseFloat(latRaw);
    const lng = parseFloat(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ label: null });
    }
    const label = await reverseGeocode(lat, lng);
    return NextResponse.json({ label });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limitParam = parseInt(req.nextUrl.searchParams.get("limit") ?? "5", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 8) : 5;

  // Don't bother the geocoder on near-empty input.
  if (q.length < 3) return NextResponse.json({ results: [] });

  try {
    const results = await searchPlaces(q, limit);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[geocode] suggest failed:", err);
    return NextResponse.json({ results: [] });
  }
}
