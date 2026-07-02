// POST /api/notifications/read
// Mark notifications read. Body:
//   { userId, id }   → mark one notification read
//   { userId }       → mark ALL of that user's notifications read
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { userId, id } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const { count } = await prisma.notification.updateMany({
      // Scope by userId too so one user can't flip another's notifications.
      where: { userId, ...(id ? { id } : {}), read: false },
      data: { read: true },
    });

    return NextResponse.json({ updated: count });
  } catch (err) {
    console.error("[notifications.read] failed:", err);
    return NextResponse.json({ error: "Failed to mark read" }, { status: 500 });
  }
}
