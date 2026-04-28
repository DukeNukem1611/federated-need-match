// Seed script — creates two NGOs with distinct volunteer pools so the
// federated-fallback demo is visibly different from the in-NGO match path,
// plus a couple of multi-NGO incidents whose timelines tell the
// "shared-knowledge-base" story (NGO A reports the flood, NGO B annotates
// the medical situation, NGO C posts a hazard advisory).
//
// Run: npm run db:seed
import {
  PrismaClient,
  UserRole,
  VolunteerStatus,
  IncidentCategory,
  IncidentStatus,
  UpdateKind,
  NeedCategory,
  Urgency,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Wipe in dependency order so reseeding is idempotent during the hackathon.
  await prisma.match.deleteMany();
  await prisma.needSkill.deleteMany();
  await prisma.incidentUpdate.deleteMany();
  await prisma.reportedNeed.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.volunteerSkill.deleteMany();
  await prisma.user.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.nGO.deleteMany();

  // ── Skills ──
  const skillNames = [
    "Medical", "First Aid", "Logistics", "Cooking",
    "Construction", "Driving", "Counseling", "General",
  ];
  const skills = Object.fromEntries(
    await Promise.all(
      skillNames.map(async name => [
        name,
        await prisma.skill.create({ data: { name } }),
      ]),
    ),
  ) as Record<string, { id: string }>;

  // ── NGOs ──
  const helpingHands = await prisma.nGO.create({
    data: { name: "Helping Hands", slug: "helping-hands", sharesPool: true },
  });
  const careFirst = await prisma.nGO.create({
    data: { name: "Care First", slug: "care-first", sharesPool: true },
  });
  const reliefNet = await prisma.nGO.create({
    data: { name: "ReliefNet", slug: "relief-net", sharesPool: true },
  });

  // ── Volunteers ──
  // Helping Hands: only LOGISTICS people — cannot fulfill a MEDICAL need.
  await prisma.user.create({
    data: {
      email: "ravi@helpinghands.org",
      name: "Ravi (Logistics)",
      role: UserRole.VOLUNTEER,
      ngoId: helpingHands.id,
      status: VolunteerStatus.AVAILABLE,
      latitude: 12.9716, longitude: 77.5946,
      maxRadiusKm: 20,
      skills: {
        create: [
          { skillId: skills["Logistics"].id, level: 4 },
          { skillId: skills["Driving"].id,   level: 5 },
        ],
      },
    },
  });
  await prisma.user.create({
    data: {
      email: "neha@helpinghands.org",
      name: "Neha (General)",
      role: UserRole.VOLUNTEER,
      ngoId: helpingHands.id,
      status: VolunteerStatus.AVAILABLE,
      latitude: 12.9750, longitude: 77.6050,
      maxRadiusKm: 10,
      skills: { create: [{ skillId: skills["General"].id, level: 3 }] },
    },
  });

  // Care First: includes MEDICAL volunteers — the federated fallback target.
  await prisma.user.create({
    data: {
      email: "asha@carefirst.org",
      name: "Dr. Asha (Medical)",
      role: UserRole.VOLUNTEER,
      ngoId: careFirst.id,
      status: VolunteerStatus.AVAILABLE,
      latitude: 12.9800, longitude: 77.6100,
      maxRadiusKm: 25,
      skills: {
        create: [
          { skillId: skills["Medical"].id,   level: 5 },
          { skillId: skills["First Aid"].id, level: 5 },
        ],
      },
    },
  });
  await prisma.user.create({
    data: {
      email: "vikram@carefirst.org",
      name: "Vikram (First Aid)",
      role: UserRole.VOLUNTEER,
      ngoId: careFirst.id,
      status: VolunteerStatus.AVAILABLE,
      latitude: 12.9650, longitude: 77.5900,
      maxRadiusKm: 15,
      skills: { create: [{ skillId: skills["First Aid"].id, level: 4 }] },
    },
  });

  // ReliefNet: shelter + cooking specialists; helps round out the demo so
  // a third NGO can post timeline updates that neither of the other two
  // organizations could have authored.
  await prisma.user.create({
    data: {
      email: "kiran@reliefnet.org",
      name: "Kiran (Shelter)",
      role: UserRole.VOLUNTEER,
      ngoId: reliefNet.id,
      status: VolunteerStatus.AVAILABLE,
      latitude: 12.9700, longitude: 77.5800,
      maxRadiusKm: 18,
      skills: {
        create: [
          { skillId: skills["Construction"].id, level: 4 },
          { skillId: skills["Logistics"].id,    level: 3 },
        ],
      },
    },
  });
  await prisma.user.create({
    data: {
      email: "meera@reliefnet.org",
      name: "Meera (Kitchen)",
      role: UserRole.VOLUNTEER,
      ngoId: reliefNet.id,
      status: VolunteerStatus.AVAILABLE,
      latitude: 12.9690, longitude: 77.5870,
      maxRadiusKm: 12,
      skills: { create: [{ skillId: skills["Cooking"].id, level: 5 }] },
    },
  });

  // ── Admins (one per NGO) ──
  const hhAdmin = await prisma.user.create({
    data: {
      email: "admin@helpinghands.org",
      name: "HH Admin",
      role: UserRole.ADMIN,
      ngoId: helpingHands.id,
    },
  });
  const cfAdmin = await prisma.user.create({
    data: {
      email: "admin@carefirst.org",
      name: "CF Admin",
      role: UserRole.ADMIN,
      ngoId: careFirst.id,
    },
  });
  const rnAdmin = await prisma.user.create({
    data: {
      email: "admin@reliefnet.org",
      name: "RN Admin",
      role: UserRole.ADMIN,
      ngoId: reliefNet.id,
    },
  });

  // ── Incidents (the shared knowledge base) ──
  // Story: ReliefNet first reported the MG Road flood. Helping Hands then
  // posted a hazard advisory about the blocked route. Care First annotated
  // a medical situation. A nearby ReportedNeed is linked to the incident
  // so the matcher can still operate on it.
  const flood = await prisma.incident.create({
    data: {
      title: "MG Road Flash Flood",
      category: IncidentCategory.FLOOD,
      status: IncidentStatus.ACTIVE,
      locationLabel: "MG Road, Bangalore",
      latitude: 12.9756, longitude: 77.6050,
      radiusKm: 1.5,
      description:
        "Heavy overnight rainfall caused waist-high flooding along MG Road and adjoining lanes. Multiple lanes impassable; coordinated response in progress.",
      createdByNgoId: reliefNet.id,
    },
  });

  await prisma.incidentUpdate.create({
    data: {
      incidentId: flood.id,
      ngoId:      reliefNet.id,
      authorId:   rnAdmin.id,
      kind:       UpdateKind.INFO,
      body:       "Flood reported around 04:30. Approx. 30+ households impacted on the eastern stretch. We are setting up a relief kitchen at the community center.",
      createdAt:  new Date(Date.now() - 1000 * 60 * 60 * 6),
    },
  });
  await prisma.incidentUpdate.create({
    data: {
      incidentId: flood.id,
      ngoId:      helpingHands.id,
      authorId:   hhAdmin.id,
      kind:       UpdateKind.HAZARD,
      body:       "MG Road is BLOCKED between Junction 4 and Trinity. Divert via Residency Road. Avoid sending heavy vehicles — drainage covers are floating.",
      latitude:   12.9760, longitude: 77.6040,
      createdAt:  new Date(Date.now() - 1000 * 60 * 60 * 4),
    },
  });
  await prisma.incidentUpdate.create({
    data: {
      incidentId: flood.id,
      ngoId:      careFirst.id,
      authorId:   cfAdmin.id,
      kind:       UpdateKind.NEED,
      body:       "3 individuals near the underpass need medical attention — minor lacerations + 1 suspected fracture. Ambulance access blocked, can reach on foot.",
      latitude:   12.9750, longitude: 77.6045,
      createdAt:  new Date(Date.now() - 1000 * 60 * 60 * 2),
    },
  });
  await prisma.incidentUpdate.create({
    data: {
      incidentId: flood.id,
      ngoId:      reliefNet.id,
      authorId:   rnAdmin.id,
      kind:       UpdateKind.RESOURCE,
      body:       "Hot meals (200 packs) staged at the community center kitchen. Volunteers welcome to pick up for distribution.",
      createdAt:  new Date(Date.now() - 1000 * 60 * 45),
    },
  });

  // A reported need linked to the incident — feeds the existing matcher.
  await prisma.reportedNeed.create({
    data: {
      ngoId:    careFirst.id,
      rawText:  "3 people near MG Road underpass need medical help, ambulance can't reach",
      category: NeedCategory.MEDICAL,
      urgency:  Urgency.CRITICAL,
      locationLabel: "MG Road underpass",
      latitude:  12.9750, longitude: 77.6045,
      isShared:  true,
      peopleAffected: 3,
      incidentId: flood.id,
      requiredSkills: {
        create: [
          { skillId: skills["Medical"].id },
          { skillId: skills["First Aid"].id },
        ],
      },
    },
  });

  // A second, lighter incident to demonstrate the index page.
  const fire = await prisma.incident.create({
    data: {
      title: "Warehouse Fire — Industrial Area",
      category: IncidentCategory.FIRE,
      status: IncidentStatus.MONITORING,
      locationLabel: "Industrial Area, Sector 4",
      latitude: 12.9550, longitude: 77.6200,
      radiusKm: 0.8,
      description:
        "Small textile warehouse fire contained by 09:00. Air quality remains poor; nearby residential block being evaluated for shelter needs.",
      createdByNgoId: helpingHands.id,
    },
  });

  await prisma.incidentUpdate.create({
    data: {
      incidentId: fire.id,
      ngoId:      helpingHands.id,
      authorId:   hhAdmin.id,
      kind:       UpdateKind.INFO,
      body:       "Fire reported at 07:45, brigade on site. Two adjacent units evacuated as a precaution.",
      createdAt:  new Date(Date.now() - 1000 * 60 * 60 * 8),
    },
  });
  await prisma.incidentUpdate.create({
    data: {
      incidentId: fire.id,
      ngoId:      reliefNet.id,
      authorId:   rnAdmin.id,
      kind:       UpdateKind.STATUS,
      body:       "Fire contained as of 09:00. Air quality still concerning; recommend masks for any field volunteers.",
      createdAt:  new Date(Date.now() - 1000 * 60 * 60 * 5),
    },
  });

  console.log("Seed complete.");
  console.log("  Helping Hands:", helpingHands.id);
  console.log("  Care First:   ", careFirst.id);
  console.log("  ReliefNet:    ", reliefNet.id);
  console.log("  Flood incident:", flood.id);
  console.log("  Fire incident: ", fire.id);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
