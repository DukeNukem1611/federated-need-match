// GET /api/ngos
// Lists all NGOs with quick counts so the dashboard switcher can show
// roll-up numbers next to each name.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ngos = await prisma.nGO.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          users: true,
          reportedNeeds: true,
        },
      },
    },
  });
  return NextResponse.json({ ngos });
}
