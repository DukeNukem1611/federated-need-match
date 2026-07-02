// List payloads must never inline photo bytes — a polled board re-downloads
// them on every refresh. Rows carry `hasPhoto` and the browser hits the
// cacheable /api/.../photo endpoints instead.
export function withPhotoFlag<T extends { photoData?: string | null }>(
  row: T,
): Omit<T, "photoData"> & { hasPhoto: boolean } {
  const { photoData, ...rest } = row;
  return { ...rest, hasPhoto: !!photoData };
}
