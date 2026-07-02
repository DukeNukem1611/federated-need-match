// Shared check for admin-only API routes. The middleware guards /admin pages,
// but mutating endpoints under /api must verify the same session cookie so the
// gate can't be bypassed with a direct request.
import type { NextRequest } from "next/server";

export function isAdminRequest(req: NextRequest): boolean {
  const expected = process.env.ADMIN_SESSION_SECRET;
  if (!expected) return false;
  return req.cookies.get("admin_auth")?.value === expected;
}
