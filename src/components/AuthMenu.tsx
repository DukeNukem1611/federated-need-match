"use client";
// Compact account control for nav bars: shows who's signed in and a logout
// button. `home` deep-links to the user's own space (dashboard or user page).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AuthMenu({
  name,
  role,
  home,
}: {
  name: string;
  role: "ADMIN" | "VOLUNTEER";
  home: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href={home}
        className="hidden items-center gap-2 rounded-md border border-black/10 bg-surface-container-high/60 px-3 py-1.5 sm:flex"
        title="Go to your workspace"
      >
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="label-caps text-on-surface-variant">{role === "ADMIN" ? "NGO" : "Volunteer"}</span>
        <span className="text-xs font-medium text-on-surface">{name}</span>
      </Link>
      <button onClick={logout} disabled={pending} className="btn-ghost">
        {pending ? "…" : "Logout"}
      </button>
    </div>
  );
}
