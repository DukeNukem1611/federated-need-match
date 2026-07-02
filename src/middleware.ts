// Auth gate for app PAGES (API routes enforce their own guards and are excluded
// from the matcher below).
//   • /admin/*  → super-admin cookie (ADMIN_SESSION_SECRET), unchanged.
//   • /login, /admin/login → always public.
//   • everything else → requires a valid user session JWT (volunteer / NGO
//                       admin) OR the super-admin cookie; otherwise bounced to
//                       /login with a `from` hint.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const ADMIN_COOKIE = "admin_auth";

function hasAdminCookie(req: NextRequest): boolean {
  const expected = process.env.ADMIN_SESSION_SECRET;
  return !!expected && req.cookies.get(ADMIN_COOKIE)?.value === expected;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always-public auth surfaces.
  if (pathname === "/login" || pathname === "/admin/login") {
    return NextResponse.next();
  }

  // Super-admin area keeps its own gate.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (hasAdminCookie(req)) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  // Everything else: a logged-in user OR the super-admin may pass.
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (session || hasAdminCookie(req)) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

// Pages only: exclude /api/*, Next internals, and any path with a file
// extension (static assets). API routes do their own auth checks.
export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
