// Notification fan-out helpers. Kept separate from the route handlers so the
// same logic can be reused (e.g. from a future incident-update hook).
import { prisma } from "@/lib/prisma";
import { incidentCategoryLabel } from "@/lib/format";
import { sendPushToUsers } from "@/lib/push";
import { sendEmailToUsers } from "@/lib/email";
import type { IncidentCategory } from "@prisma/client";

// Notify volunteers who landed in a need's recommendation list, so they know
// they've been suggested for a deployment. BUSY volunteers are skipped (they
// asked not to be pulled onto new work). `incidentId` deep-links the bell to
// the need's incident when it has one. Returns the number notified.
export async function notifyVolunteersOfRecommendation(
  need: {
    id: string;
    rawText: string;
    ngoName?: string | null;
    incidentId?: string | null;
  },
  volunteerIds: string[],
): Promise<number> {
  if (volunteerIds.length === 0) return 0;

  // Only volunteers who are not BUSY (AVAILABLE / OFFLINE / unset) get pinged.
  const recipients = await prisma.user.findMany({
    where: { id: { in: volunteerIds }, status: { not: "BUSY" } },
    select: { id: true },
  });
  if (recipients.length === 0) return 0;

  const snippet = need.rawText.length > 80 ? need.rawText.slice(0, 80) + "…" : need.rawText;
  const title = "You've been recommended for a need";
  const body = `${need.ngoName ?? "An NGO"} may need your help: "${snippet}"`;

  await prisma.notification.createMany({
    data: recipients.map(r => ({
      userId: r.id,
      type: "GENERAL" as const,
      title,
      body,
      ...(need.incidentId ? { incidentId: need.incidentId } : {}),
    })),
  });

  // Also deliver browser push + email (best-effort — never block the feed).
  const url = need.incidentId ? `/incidents/${need.incidentId}` : "/";
  try {
    await sendPushToUsers(recipients.map(r => r.id), { title, body, url });
  } catch (err) {
    console.error("[push] recommendation push failed:", err);
  }
  try {
    await sendEmailToUsers(recipients.map(r => r.id), { subject: title, body, url });
  } catch (err) {
    console.error("[email] recommendation email failed:", err);
  }

  return recipients.length;
}

// Tell the need's NGO admins that an assigned volunteer responded
// (accepted / declined / completed), so the coordinator isn't left guessing.
export async function notifyNgoOfMatchResponse(
  need: { id: string; rawText: string; ngoId: string; incidentId?: string | null },
  volunteerName: string,
  response: "accepted" | "declined" | "completed",
): Promise<number> {
  const admins = await prisma.user.findMany({
    where: { ngoId: need.ngoId, role: "ADMIN" },
    select: { id: true },
  });
  if (admins.length === 0) return 0;

  const snippet = need.rawText.length > 70 ? need.rawText.slice(0, 70) + "…" : need.rawText;
  const titles = {
    accepted:  `✔ ${volunteerName} accepted an assignment`,
    declined:  `✕ ${volunteerName} declined an assignment`,
    completed: `★ ${volunteerName} completed an assignment`,
  } as const;
  const title = titles[response];
  const body = `Need: "${snippet}"${response === "declined" ? " — run Find Match again for the next candidate." : ""}`;

  await prisma.notification.createMany({
    data: admins.map(a => ({
      userId: a.id,
      type: "GENERAL" as const,
      title,
      body,
      ...(need.incidentId ? { incidentId: need.incidentId } : {}),
    })),
  });

  const url = need.incidentId ? `/incidents/${need.incidentId}` : "/";
  try {
    await sendPushToUsers(admins.map(a => a.id), { title, body, url });
  } catch (err) {
    console.error("[push] match-response push failed:", err);
  }
  try {
    await sendEmailToUsers(admins.map(a => a.id), { subject: title, body, url });
  } catch (err) {
    console.error("[email] match-response email failed:", err);
  }

  return admins.length;
}

// Fan a "new incident" notification out to EVERY user on the platform.
// Returns the number of recipients notified.
export async function notifyAllUsersOfIncident(incident: {
  id: string;
  title: string;
  category: IncidentCategory;
  locationLabel: string;
  createdByNgo?: { name: string } | null;
}): Promise<number> {
  // Only the ids are needed for the fan-out.
  const users = await prisma.user.findMany({ select: { id: true } });
  if (users.length === 0) return 0;

  const source = incident.createdByNgo?.name ?? "an NGO";
  const title = `New ${incidentCategoryLabel[incident.category]} incident: ${incident.title}`;
  const messageBody = `${source} filed a new incident at ${incident.locationLabel}.`;

  await prisma.notification.createMany({
    data: users.map(u => ({
      userId: u.id,
      type: "INCIDENT_NEW" as const,
      title,
      body: messageBody,
      incidentId: incident.id,
    })),
  });

  // Browser push + email for the same event (best-effort).
  try {
    await sendPushToUsers(users.map(u => u.id), {
      title,
      body: messageBody,
      url: `/incidents/${incident.id}`,
    });
  } catch (err) {
    console.error("[push] incident push failed:", err);
  }
  try {
    await sendEmailToUsers(users.map(u => u.id), {
      subject: title,
      body: messageBody,
      url: `/incidents/${incident.id}`,
    });
  } catch (err) {
    console.error("[email] incident email failed:", err);
  }

  return users.length;
}
