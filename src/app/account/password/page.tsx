// Change-password screen. Reachable after login; volunteers with a default
// password are routed here automatically (?first=1).
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/account/password");

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full bg-primary-container/10 blur-[140px]" />
      <Suspense fallback={null}>
        <ChangePasswordForm
          role={session.role}
          ngoId={session.ngoId}
          userId={session.uid}
        />
      </Suspense>
    </main>
  );
}
