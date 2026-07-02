// Shared input validation helpers, used by both client forms (instant feedback)
// and API routes (defense-in-depth) so the rules never drift apart.

// Pragmatic email check: a non-empty local part, an "@", a domain with at least
// one dot, and no whitespace. Deliberately permissive — full RFC 5322 is not
// worth the complexity, and the real source of truth is the unique constraint
// in the DB plus eventual delivery.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: unknown): boolean {
  return typeof email === "string" && EMAIL_RE.test(email.trim());
}

// Attached photos are stored inline as data URLs. ~2M chars ≈ 1.5 MB decoded,
// matching the client-side compression cap in PhotoUpload.
const MAX_PHOTO_CHARS = 2_000_000;

// Returns the photo when valid, null when absent, and undefined when the
// value is present but invalid (wrong type, not an inline image, or too big)
// so callers can 400 instead of persisting something that would render as a
// broken — or worse, malicious — src.
export function validatePhoto(photoData: unknown): string | null | undefined {
  if (photoData == null) return null;
  if (
    typeof photoData !== "string" ||
    !/^data:image\/(jpeg|png|webp|gif);base64,/.test(photoData) ||
    photoData.length > MAX_PHOTO_CHARS
  ) {
    return undefined;
  }
  return photoData;
}
