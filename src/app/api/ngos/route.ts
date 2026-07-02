// GET  /api/ngos — list all NGOs with quick counts.
// POST /api/ngos — register a new NGO (platform-admin action). Optionally
//                  seeds a first admin user for the org in the same request.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest } from "@/lib/admin-auth";
import { isValidEmail } from "@/lib/validation";
import { hashPassword } from "@/lib/auth";
import { requireViewer } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireViewer(req);
  if ("error" in auth) return auth.error;

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

// "Helping Hands" → "helping-hands". Strips punctuation, collapses spaces.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: NextRequest) {
  // Registering an NGO is a platform-admin action — require the session cookie.
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { name, sharesPool, adminName, adminEmail, adminPassword } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // An NGO needs a login to be usable, so require its first admin's name+email.
    if (!adminName?.trim() || !adminEmail?.trim()) {
      return NextResponse.json(
        { error: "An NGO admin name and email are required so the NGO can sign in." },
        { status: 400 },
      );
    }
    if (!isValidEmail(adminEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid admin email address." },
        { status: 400 },
      );
    }

    // Ensure a unique slug — append -2, -3, … on collision.
    const base = slugify(name) || "ngo";
    let slug = base;
    let n = 2;
    while (await prisma.nGO.findUnique({ where: { slug } })) {
      slug = `${base}-${n++}`;
    }

    // Default admin password (typed or generated); admin changes it on first login.
    const password =
      typeof adminPassword === "string" && adminPassword.trim().length >= 6
        ? adminPassword.trim()
        : Math.random().toString(36).slice(2, 10);

    const ngo = await prisma.nGO.create({
      data: {
        name: name.trim(),
        slug,
        sharesPool: sharesPool ?? true,
        users: {
          create: {
            name: adminName.trim(),
            email: adminEmail.trim().toLowerCase(),
            role: "ADMIN",
            passwordHash: await hashPassword(password),
            mustChangePassword: true,
          },
        },
      },
      include: { _count: { select: { users: true, reportedNeeds: true } } },
    });

    // Return the admin credential once so the super-admin can hand it over.
    return NextResponse.json(
      { ngo, adminCredential: { email: adminEmail.trim().toLowerCase(), password } },
      { status: 201 },
    );
  } catch (err: any) {
    // Unique-constraint violation on a duplicate admin email.
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "An admin with that email already exists." },
        { status: 409 },
      );
    }
    console.error("[ngos.create] failed:", err);
    return NextResponse.json({ error: "Failed to create NGO" }, { status: 500 });
  }
}
