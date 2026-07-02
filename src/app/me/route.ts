// GET /me — session-aware redirect to "my space". Push notifications and
// emails can't know per-recipient destinations at send time (one payload fans
// out to many users), so they link here and each reader lands in their own
// workspace: NGO admins on their dashboard, volunteers on their user page.
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const dest = !session
    ? "/login?from=%2Fme"
    : session.role === "ADMIN"
      ? `/dashboard/${session.ngoId}`
      : `/user/${session.uid}`;
  return NextResponse.redirect(new URL(dest, req.url));
}
