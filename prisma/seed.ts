// Seed script — thin wrapper around the shared demo seeder so the exact same
// data can be loaded from the CLI (npm run db:seed) and the super-admin's
// "Reset demo data" button.
// Run: npm run db:seed
import { PrismaClient } from "@prisma/client";
import { seedDemo } from "../src/lib/demo-seed";

const prisma = new PrismaClient();

seedDemo(prisma)
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
