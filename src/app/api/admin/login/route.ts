// Validate the admin password and, on success, drop an httpOnly session
// cookie. The cookie holds ADMIN_SESSION_SECRET (an opaque value that never
// reaches client-side JS), which the middleware checks on every /admin hit.
import { NextResponse } from "next/server";

const COOKIE = "admin_auth";
const MAX_AGE = 60 * 60 * 8; // 8 hours

export async function POST(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!expected || !secret) {
    return NextResponse.json(
      { error: "Admin auth is not configured (ADMIN_PASSWORD / ADMIN_SESSION_SECRET)." },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";

  if (password !== expected) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}
