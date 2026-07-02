// PATCH /api/matches/:id — the assigned volunteer responds to their match:
//   { action: "accept" }   PROPOSED → ACCEPTED   (need → IN_PROGRESS, volunteer BUSY + deployed)
//   { action: "decline" }  PROPOSED/ACCEPTED → DECLINED (need reopens; volunteer freed;
//                          the matcher won't propose them for this need again)
//   { action: "complete" } ACCEPTED → COMPLETED  (need → RESOLVED, volunteer freed)
// The need's NGO admins are notified of every response.
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { notifyNgoOfMatchResponse } from "@/services/notifications/notify";

const TRANSITIONS: Record<string, { from: string[]; to: "ACCEPTED" | "DECLINED" | "COMPLETED" }> = {
  accept:   { from: ["PROPOSED"],             to: "ACCEPTED" },
  decline:  { from: ["PROPOSED", "ACCEPTED"], to: "DECLINED" },
  complete: { from: ["ACCEPTED"],             to: "COMPLETED" },
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  try {
    const { action } = (await req.json()) as { action?: string };
    const transition = action ? TRANSITIONS[action] : undefined;
    if (!transition) {
      return NextResponse.json(
        { error: "action must be accept, decline, or complete" },
        { status: 400 },
      );
    }

    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: { need: { select: { id: true, rawText: true, ngoId: true, incidentId: true, status: true } } },
    });
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }
    // Only the volunteer this match is for may respond.
    if (match.volunteerId !== auth.session.uid) {
      return NextResponse.json({ error: "Forbidden — not your assignment" }, { status: 403 });
    }
    if (!transition.from.includes(match.status)) {
      return NextResponse.json(
        { error: `Cannot ${action} a ${match.status} assignment` },
        { status: 409 },
      );
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.match.update({ where: { id: match.id }, data: { status: transition.to } }),
    ];

    if (action === "accept") {
      ops.push(
        prisma.reportedNeed.update({ where: { id: match.needId }, data: { status: "IN_PROGRESS" } }),
        prisma.user.update({
          where: { id: match.volunteerId },
          data: { status: "BUSY", activeNeed: { connect: { id: match.needId } } },
        }),
      );
    } else if (action === "decline") {
      // Reopen the need unless some other volunteer has it accepted.
      const otherAccepted = await prisma.match.count({
        where: { needId: match.needId, status: "ACCEPTED", id: { not: match.id } },
      });
      if (otherAccepted === 0 && match.need.status !== "RESOLVED" && match.need.status !== "CANCELLED") {
        ops.push(
          prisma.reportedNeed.update({ where: { id: match.needId }, data: { status: "OPEN" } }),
        );
      }
      ops.push(
        prisma.user.update({
          where: { id: match.volunteerId },
          data: {
            status: "AVAILABLE",
            ...(match.needId ? { activeNeed: { disconnect: true } } : {}),
          },
        }),
      );
    } else {
      // complete
      ops.push(
        prisma.reportedNeed.update({ where: { id: match.needId }, data: { status: "RESOLVED" } }),
        prisma.user.update({
          where: { id: match.volunteerId },
          data: { status: "AVAILABLE", activeNeed: { disconnect: true } },
        }),
      );
    }

    await prisma.$transaction(ops);

    // Best-effort — never fail the response over a notification.
    try {
      const me = await prisma.user.findUnique({
        where: { id: match.volunteerId },
        select: { name: true },
      });
      await notifyNgoOfMatchResponse(
        match.need,
        me?.name ?? "A volunteer",
        transition.to.toLowerCase() as "accepted" | "declined" | "completed",
      );
    } catch (err) {
      console.error("[matches.respond] notify failed:", err);
    }

    return NextResponse.json({ ok: true, status: transition.to });
  } catch (err) {
    console.error("[matches.respond] failed:", err);
    return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
  }
}
