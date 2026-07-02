// POST /api/push/subscribe — store the browser's PushSubscription for the
// logged-in user (keyed by its unique endpoint, so re-subscribing is idempotent
// and multiple devices each get a row).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: session.uid, p256dh, auth },
    create: { endpoint, p256dh, auth, userId: session.uid },
  });

  return NextResponse.json({ ok: true });
}
