"use client";
// Platform-admin form → POST /api/ngos. Optionally seeds the org's first
// admin user in the same request.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidEmail } from "@/lib/validation";

export function AddNgoForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [sharesPool, setSharesPool] = useState(true);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  // The admin credential to hand over, shown once after creation.
  const [cred, setCred] = useState<{ email: string; password: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setCred(null);
    if (!name.trim()) {
      setError("NGO name is required.");
      return;
    }
    if (!adminName.trim() || !adminEmail.trim()) {
      setError("An NGO admin name and email are required so the NGO can sign in.");
      return;
    }
    if (!isValidEmail(adminEmail)) {
      setError("Please enter a valid admin email address.");
      return;
    }
    if (adminPassword.trim() && adminPassword.trim().length < 6) {
      setError("Admin password must be at least 6 characters (or leave blank to auto-generate).");
      return;
    }
    setPending(true);
    const res = await fetch("/api/ngos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        sharesPool,
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword: adminPassword.trim() || undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setError(error ?? "Failed to create NGO");
      return;
    }
    const { ngo, adminCredential } = await res.json();
    setOk(`Created "${ngo.name}" (/${ngo.slug}). Share the admin credentials below.`);
    if (adminCredential) setCred(adminCredential);
    setName("");
    setAdminName("");
    setAdminEmail("");
    setAdminPassword("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="glass-panel relative overflow-hidden rounded-xl p-6">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary-container/60 to-transparent" />
      <p className="label-caps text-surface-tint">Register</p>
      <h2 className="heading mt-1 text-xl font-semibold text-on-surface">Add an NGO</h2>

      <div className="mt-5 grid gap-4">
        <label>
          <span className="label-caps mb-1.5 block">NGO name</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Coastal Rescue Collective"
            className="input-field"
          />
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={sharesPool}
            onChange={e => setSharesPool(e.target.checked)}
            className="h-4 w-4 accent-emerald-400"
          />
          <span className="text-sm text-on-surface-variant">
            Share volunteer pool with the federated network
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label-caps mb-1.5 block">NGO admin name</span>
            <input
              value={adminName}
              onChange={e => setAdminName(e.target.value)}
              placeholder="Jordan Admin"
              className="input-field"
            />
          </label>
          <label>
            <span className="label-caps mb-1.5 block">NGO admin email</span>
            <input
              type="email"
              value={adminEmail}
              onChange={e => setAdminEmail(e.target.value)}
              placeholder="admin@org.org"
              className="input-field"
            />
          </label>
        </div>

        <label>
          <span className="label-caps mb-1.5 block">Admin password (optional)</span>
          <input
            value={adminPassword}
            onChange={e => setAdminPassword(e.target.value)}
            placeholder="Leave blank to auto-generate"
            className="input-field"
          />
          <span className="mt-1 block text-[11px] text-on-surface-variant">
            The NGO admin changes this on first login.
          </span>
        </label>

        {error && (
          <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {ok && (
          <p className="rounded-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
            {ok}
          </p>
        )}
        {cred && (
          <div className="rounded-md border border-primary-container/30 bg-primary-container/10 px-3 py-3 text-sm">
            <p className="label-caps text-on-surface-variant">NGO admin credentials</p>
            <p className="mono-data mt-1.5 text-on-surface">{cred.email}</p>
            <p className="mono-data text-on-surface">
              Password: <span className="text-primary-container">{cred.password}</span>
            </p>
          </div>
        )}

        <div className="flex justify-end border-t border-black/5 pt-4">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Creating…" : "Create NGO"}
            <span>↗</span>
          </button>
        </div>
      </div>
    </form>
  );
}
