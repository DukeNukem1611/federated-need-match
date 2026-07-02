// Server-side auth helpers (Node runtime): password hashing and reading the
// current session/user inside server components & route handlers. Builds on the
// edge-safe primitives in `src/lib/session.ts`.
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session";

const SALT_ROUNDS = 10;
const ADMIN_COOKIE = "admin_auth";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

// The verified session payload for the current request, or null.
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

// The full User row (with ngo) behind the current session, or null.
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.uid },
    include: { ngo: { select: { id: true, name: true, slug: true } } },
  });
}

// True when the request carries the platform super-admin cookie.
export function isSuperAdmin(): boolean {
  const expected = process.env.ADMIN_SESSION_SECRET;
  return !!expected && cookies().get(ADMIN_COOKIE)?.value === expected;
}

// Page-level guard (defense-in-depth alongside middleware): a server component
// can call `await requirePageAuth()` at the top to guarantee the viewer is
// either a signed-in user or the super-admin, redirecting to /login otherwise.
// Returns the viewer so callers can branch on role/ownership.
export async function requirePageAuth(): Promise<{
  session: SessionPayload | null;
  superAdmin: boolean;
}> {
  const session = await getSession();
  if (session) return { session, superAdmin: false };
  if (isSuperAdmin()) return { session: null, superAdmin: true };
  redirect("/login");
}
