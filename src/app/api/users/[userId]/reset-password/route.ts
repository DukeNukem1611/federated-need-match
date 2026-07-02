// POST /api/users/:userId/reset-password
// NGO admin (or super-admin) issues a member a fresh default password when
// they've forgotten theirs. Mirrors the create flow: the new password is
// returned once so the admin can hand it over, and the member is forced to
// change it at next login.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { isAdminRequest } from "@/lib/admin-auth";
import { requireNgoAdmin } from "@/lib/api-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  const { userId } = params;
  try {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { ngoId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!isAdminRequest(req)) {
      const auth = await requireNgoAdmin(req, existing.ngoId);
      if ("error" in auth) return auth.error;
    }

    // Same generator as member creation in /api/users (POST).
    const defaultPassword = Math.random().toString(36).slice(2, 10);
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hashPassword(defaultPassword),
        mustChangePassword: true,
      },
    });

    return NextResponse.json({ defaultPassword });
  } catch (err) {
    console.error("[users.reset-password] failed:", err);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
