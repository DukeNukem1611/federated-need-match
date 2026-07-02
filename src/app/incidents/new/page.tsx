// File a new incident. Server component that loads the NGO list, then
// hands the actual form to a small client component below.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requirePageAuth } from "@/lib/auth";
import { NewIncidentForm } from "./NewIncidentForm";

export const dynamic = "force-dynamic";

export default async function NewIncidentPage() {
  await requirePageAuth();

  // A logged-in user always files as their own NGO (the server enforces this on
  // POST), so the form is locked to it — no selector, regardless of how they got
  // here (dashboard, user page, or the incident board). The super-admin has no
  // user session, so they fall back to picking an NGO.
  const me = await getCurrentUser();
  const lockedNgo = me ? { id: me.ngo.id, name: me.ngo.name } : null;

  const ngos = lockedNgo
    ? []
    : await prisma.nGO.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full bg-primary-container/10 blur-[140px]" />

      <nav className="relative z-10 border-b border-black/5 bg-surface/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 sm:px-10">
          <Link href="/" className="flex items-center gap-3 text-primary-container hover:text-primary">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-primary-container/15">
              <span className="heading text-lg font-bold">◆</span>
            </div>
            <span className="heading text-lg font-bold uppercase tracking-[0.18em]">
              Federated Relief
            </span>
          </Link>
          <Link href="/incidents" className="btn-ghost">← All Incidents</Link>
        </div>
      </nav>

      <section className="relative z-10 mx-auto max-w-2xl px-6 py-12 sm:px-10">
        <header className="mb-8">
          <p className="label-caps text-surface-tint">Open Record</p>
          <h1 className="heading mt-2 text-3xl font-bold text-on-surface sm:text-4xl">
            File a New Incident
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Once filed, any NGO can append updates — hazards, needs, resources,
            status changes. Be specific so other organizations arriving later
            know what to expect.
          </p>
        </header>

        <NewIncidentForm
          ngos={ngos}
          lockedNgo={lockedNgo ?? undefined}
          mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
        />
      </section>
    </main>
  );
}
