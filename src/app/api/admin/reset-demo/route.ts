// POST /api/admin/reset-demo — super-admin wipes everything and restores the
// canonical demo state (same code path as `npm run db:seed`). Destructive by
// design; the UI double-confirms before calling this.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/admin-auth";
import { seedDemo } from "@/lib/demo-seed";

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await seedDemo(prisma);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin.reset-demo] failed:", err);
    return NextResponse.json({ error: "Reset failed" }, { status: 500 });
  }
}
