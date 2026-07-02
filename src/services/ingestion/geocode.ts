// Shared server-side geocoding. Turns a free-text place label
// (e.g. "MMM Hall, IIT Kharagpur") into coordinates so both incidents and
// ingested needs land at a real location instead of defaulting to a fixed point.
//
// Uses OpenStreetMap's Nominatim, which needs no API key. Two things make it
// robust enough for messy field input:
//   1. Progressive fallback — if the full, over-specific label finds nothing,
//      we drop the most-specific leading segment and retry on the broader area
//      ("MMM Hall, IIT Kharagpur" → "IIT Kharagpur" → "Kharagpur").
//   2. A small in-process cache so repeated labels don't hammer the public
//      endpoint (Nominatim's usage policy asks for light, identified traffic).
//
// `searchPlaces` returns several matches and powers the location typeahead, so
// users who want pinpoint accuracy can pick the exact result instead of relying
// on the fallback. `geocodePlace` is the single-best-guess path used when there
// is no human in the loop (need ingestion, or a label typed without a pick).

export type GeoResult = { lat: number; lng: number; matchedLabel: string };

const cache = new Map<string, GeoResult | null>();

// Build progressively broader candidate queries from a comma-delimited label.
// Each step drops the leading (most specific) segment but always keeps the
// trailing context, so we degrade toward the surrounding area, not noise.
function candidates(label: string): string[] {
  const segments = label
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  if (segments.length === 0) return out;

  // Full label first, then progressively drop the front segment.
  for (let start = 0; start < segments.length; start++) {
    out.push(segments.slice(start).join(", "));
  }
  return out;
}

// Raw Nominatim search. Returns up to `limit` matches, best first.
export async function searchPlaces(
  query: string,
  limit = 5,
): Promise<GeoResult[]> {
  const q = query.trim();
  if (!q) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=${limit}&q=${encodeURIComponent(
    q,
  )}`;
  const res = await fetch(url, {
    headers: {
      // Nominatim's usage policy requires an identifying User-Agent.
      "User-Agent": "FederatedReliefSystem/1.0 (relief-demo)",
    },
  });
  if (!res.ok) return [];

  const data = await res.json();
  if (!Array.isArray(data)) return [];

  return data
    .map((d: any) => ({
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
      matchedLabel: d.display_name ?? q,
    }))
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

// Reverse: coordinates → a human-readable label. Powers the "pin on map"
// picker, so dropping a point fills in a sensible location name.
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FederatedReliefSystem/1.0 (relief-demo)" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.display_name === "string" ? data.display_name : null;
  } catch {
    return null;
  }
}

// Best single guess, with progressive fallback for over-specific labels.
export async function geocodePlace(label: string): Promise<GeoResult | null> {
  const key = label.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key)!;

  try {
    for (const query of candidates(label)) {
      const [hit] = await searchPlaces(query, 1);
      if (hit) {
        cache.set(key, hit);
        return hit;
      }
    }
    cache.set(key, null);
    return null;
  } catch {
    // Network blip — don't cache failures so a later retry can succeed.
    return null;
  }
}
