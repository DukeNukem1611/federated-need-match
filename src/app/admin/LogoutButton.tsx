"use client";
// Clears the admin session cookie via /api/admin/logout, then sends the user
// back to the login page.
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={logout} className="btn-ghost" disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
