// Request guards for route handlers. Each returns either the verified session
// or a ready-to-return error response, so handlers can do:
//   const r = await requireNgoAdmin(req, ngoId);
//   if ("error" in r) return r.error;
//   // ...use r.session
import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session";
import { isAdminRequest } from "@/lib/admin-auth";

export type Guard =
  | { session: SessionPayload }
  | { error: NextResponse };

// Session may be null for the super-admin, who authenticates via the
// admin cookie rather than a user account.
export type ViewerGuard =
  | { session: SessionPayload | null; superAdmin: boolean }
  | { error: NextResponse };

// Anyone allowed to *read* app data: a signed-in user or the super-admin.
// Mirrors the page-level middleware gate so API responses can't be fetched
// anonymously even though /api is excluded from the middleware matcher.
export async function requireViewer(req: NextRequest): Promise<ViewerGuard> {
  if (isAdminRequest(req)) return { session: null, superAdmin: true };
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { session, superAdmin: false };
}

// Any authenticated user (volunteer or NGO admin).
export async function requireUser(req: NextRequest): Promise<Guard> {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { session };
}

// A user belonging to the given NGO (admin or volunteer).
export async function requireNgoMember(req: NextRequest, ngoId: string): Promise<Guard> {
  const r = await requireUser(req);
  if ("error" in r) return r;
  if (r.session.ngoId !== ngoId) {
    return { error: NextResponse.json({ error: "Forbidden — not your NGO" }, { status: 403 }) };
  }
  return r;
}

// The NGO's admin specifically (e.g. managing volunteers).
export async function requireNgoAdmin(req: NextRequest, ngoId: string): Promise<Guard> {
  const r = await requireNgoMember(req, ngoId);
  if ("error" in r) return r;
  if (r.session.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "NGO admin only" }, { status: 403 }) };
  }
  return r;
}
