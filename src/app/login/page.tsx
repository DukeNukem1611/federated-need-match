// Login landing — an attractive, lively split-screen. Left: branded hero with
// drifting aurora glows, a rotating tagline, and animated count-up success
// stats from Prisma. Right: the sign-in form (Volunteer | NGO). Server
// component so the stats are always fresh.
import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CountUp } from "@/components/CountUp";
import { RotatingText } from "@/components/RotatingText";
import { InstallButton } from "@/components/InstallButton";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [ngos, volunteers, incidents, matchedNeeds] = await Promise.all([
    prisma.nGO.count(),
    prisma.user.count({ where: { role: "VOLUNTEER" } }),
    prisma.incident.count(),
    prisma.reportedNeed.count({
      where: { status: { in: ["MATCHED", "IN_PROGRESS", "RESOLVED"] } },
    }),
  ]);

  const stats = [
    { label: "NGOs Connected",        value: ngos,         icon: "◈" },
    { label: "Volunteers Ready",      value: volunteers,   icon: "◉" },
    { label: "Incidents Coordinated", value: incidents,    icon: "◆" },
    { label: "Needs Matched",         value: matchedNeeds, icon: "✦" },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* ── Left: branded hero + live stats ── */}
      <section className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-container/12 via-surface to-surface-tint/10 px-8 py-12 sm:px-12">
        {/* Drifting aurora glows */}
        <div className="pointer-events-none absolute -top-32 -left-20 h-96 w-96 animate-aurora rounded-full bg-primary-container/20 blur-[130px]" />
        <div className="pointer-events-none absolute top-1/3 -right-10 h-80 w-80 animate-aurora-slow rounded-full bg-surface-tint/20 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 h-80 w-80 animate-float-slow rounded-full bg-primary-container/10 blur-[110px]" />

        <div className="relative z-10">
          <Link href="/login" className="flex items-center gap-3 text-primary-container">
            <div className="flex h-10 w-10 animate-float items-center justify-center rounded-md bg-primary-container/15">
              <span className="heading text-xl font-bold">◆</span>
            </div>
            <span className="heading text-lg font-bold uppercase tracking-[0.18em]">
              Federated Relief
            </span>
          </Link>

          <div className="mt-14 max-w-md">
            <div className="mb-5 inline-flex animate-fade-in-up items-center gap-2 rounded-full border border-primary-container/30 bg-primary-container/10 px-3 py-1">
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-emerald-500" />
              <span className="label-caps text-on-surface-variant">Coordinating relief, live</span>
            </div>
            <h1
              className="heading text-glow animate-fade-in-up text-4xl font-bold leading-[1.08] tracking-tight text-on-surface sm:text-5xl"
              style={{ animationDelay: "80ms" }}
            >
              Route every need to the right volunteer.
            </h1>
            <p
              className="mt-4 animate-fade-in-up text-base leading-relaxed text-on-surface-variant"
              style={{ animationDelay: "160ms" }}
            >
              One command center for{" "}
              <RotatingText
                className="font-semibold text-primary-container"
                phrases={[
                  "multi-NGO disaster response.",
                  "shared incident timelines.",
                  "federated volunteer matching.",
                  "real-time relief hotspots.",
                ]}
              />
              <br />
              Sign in to pick up where the field left off.
            </p>
          </div>
        </div>

        {/* Live success stats (animated count-up, staggered entrance) */}
        <div className="relative z-10 mt-12 grid grid-cols-2 gap-4 sm:max-w-lg">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="glass-panel animate-fade-in-up rounded-xl p-5 transition-transform hover:-translate-y-1 hover:shadow-glow-cyan"
              style={{ animationDelay: `${240 + i * 90}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="label-caps">{s.label}</span>
                <span className="mono-data text-primary-container">{s.icon}</span>
              </div>
              <CountUp
                value={s.value}
                className="heading mt-3 block text-3xl font-bold text-on-surface"
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── Right: sign-in form ── */}
      <section className="relative flex min-h-screen items-center justify-center px-6 py-12 sm:px-10 lg:min-h-0">
        <div className="w-full max-w-sm animate-fade-in-up" style={{ animationDelay: "120ms" }}>
          <div className="mb-8">
            <p className="label-caps text-surface-tint">Welcome back</p>
            <h2 className="heading mt-2 text-3xl font-bold text-on-surface">Sign in</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Choose your account type, then enter your credentials.
            </p>
          </div>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>

          <div className="mt-6 flex items-center gap-3 border-t border-black/5 pt-5">
            <InstallButton />
            <span className="text-[11px] text-on-surface-variant">
              Add Relief to your home screen for one-tap access.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
