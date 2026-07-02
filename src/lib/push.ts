// Web Push delivery. Sends an OS-level browser notification to every device a
// user has subscribed, and prunes subscriptions the push service has expired.
// No-ops gracefully when VAPID keys aren't configured, so the in-app feed still
// works without push set up.
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  // Optional action buttons rendered on the OS notification (Android/desktop
  // Chrome; iOS ignores them). `matchId` lets the service worker call the
  // assignment API directly from the notification shade.
  actions?: { action: string; title: string }[];
  matchId?: string;
};

// Push to all subscriptions of the given users. Returns the number delivered.
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<number> {
  if (userIds.length === 0) return 0;
  if (!ensureConfigured()) return 0;

  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  if (subs.length === 0) return 0;

  const data = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async s => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
        sent++;
      } catch (err: any) {
        // 404 / 410 → the subscription is gone (unsubscribed / expired): prune.
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          dead.push(s.endpoint);
        } else {
          console.error("[push] send failed:", err?.statusCode, err?.body ?? err?.message);
        }
      }
    }),
  );

  if (dead.length) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: dead } } });
  }
  return sent;
}
