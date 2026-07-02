// Edge-safe session helpers. Kept free of bcrypt / next/headers / prisma so the
// middleware (Edge runtime) can verify a session token without pulling in the
// Node-only auth machinery. `src/lib/auth.ts` builds on this for server use.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "session";
export const MAX_AGE = 60 * 60 * 8; // 8 hours, mirrors the admin cookie
// "Keep me signed in" — installed-app users shouldn't be bounced to login
// every morning. 30 days, refreshed on each login.
export const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;

export type SessionRole = "ADMIN" | "VOLUNTEER";

export type SessionPayload = {
  uid: string;
  role: SessionRole;
  ngoId: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is not configured.");
  }
  return new TextEncoder().encode(secret);
}

// Sign a compact HS256 JWT carrying just the identity claims we need.
export async function signSession(
  payload: SessionPayload,
  maxAge: number = MAX_AGE,
): Promise<string> {
  return new SignJWT({ uid: payload.uid, role: payload.role, ngoId: payload.ngoId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secretKey());
}

// Verify a token and narrow it back to a SessionPayload, or null when invalid /
// expired / missing. Never throws.
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.uid === "string" &&
      (payload.role === "ADMIN" || payload.role === "VOLUNTEER") &&
      typeof payload.ngoId === "string"
    ) {
      return { uid: payload.uid, role: payload.role, ngoId: payload.ngoId };
    }
    return null;
  } catch {
    return null;
  }
}
