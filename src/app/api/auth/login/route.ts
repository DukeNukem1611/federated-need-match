// POST /api/auth/login — authenticate a volunteer or NGO admin.
// Body: { email, password, expectedRole? }. On success sets the httpOnly
// `session` cookie (signed JWT) and returns the routing info the client needs.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { signSession, SESSION_COOKIE, MAX_AGE } from "@/lib/session";

export async function POST(req: Request) {
  if (!process.env.AUTH_SESSION_SECRET) {
    return NextResponse.json(
      { error: "Auth is not configured (AUTH_SESSION_SECRET)." },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  // Optional: when the login form's Volunteer|NGO tab is set, we enforce that
  // the account actually has that role so the two flows stay distinct.
  const expectedRole =
    body?.expectedRole === "ADMIN" || body?.expectedRole === "VOLUNTEER"
      ? body.expectedRole
      : null;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Uniform error so we don't reveal which part was wrong.
  const invalid = NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return invalid;
  }

  if (expectedRole && user.role !== expectedRole) {
    return NextResponse.json(
      {
        error:
          expectedRole === "ADMIN"
            ? "This account is a volunteer account — use the Volunteer tab."
            : "This account is an NGO account — use the NGO tab.",
      },
      { status: 403 },
    );
  }

  const token = await signSession({ uid: user.id, role: user.role, ngoId: user.ngoId });

  const res = NextResponse.json({
    ok: true,
    role: user.role,
    userId: user.id,
    ngoId: user.ngoId,
    mustChangePassword: user.mustChangePassword,
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}
