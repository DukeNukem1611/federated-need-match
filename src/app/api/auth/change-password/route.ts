// POST /api/auth/change-password — change the logged-in user's password.
// Body: { currentPassword?, newPassword }. When the account is flagged
// mustChangePassword (a default issued by an admin), currentPassword is
// optional; otherwise it must match. Clears the flag on success.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";

const MIN_LEN = 6;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (newPassword.length < MIN_LEN) {
    return NextResponse.json(
      { error: `New password must be at least ${MIN_LEN} characters.` },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Unless this is a forced first-login change, the current password must match.
  if (!user.mustChangePassword) {
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
  });

  return NextResponse.json({ ok: true });
}
