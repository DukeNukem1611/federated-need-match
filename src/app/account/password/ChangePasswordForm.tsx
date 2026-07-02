"use client";
// Change-password form. In "first login" mode (a default password issued by an
// admin) the current-password field is hidden; otherwise it's required.
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function ChangePasswordForm({
  role,
  ngoId,
  userId,
}: {
  role: "ADMIN" | "VOLUNTEER";
  ngoId: string;
  userId: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const first = params.get("first") === "1";

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const home = role === "ADMIN" ? `/dashboard/${ngoId}` : `/user/${userId}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setPending(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      setError(data?.error ?? "Failed to change password.");
      return;
    }
    router.replace(home);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="glass-panel w-full max-w-sm rounded-xl p-8">
      <div className="mb-6">
        <p className="label-caps text-surface-tint">Account Security</p>
        <h1 className="heading mt-2 text-2xl font-bold text-on-surface">
          {first ? "Set your password" : "Change password"}
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          {first
            ? "You're using a default password set by your NGO. Choose a personal one to continue."
            : "Pick a new password for your account."}
        </p>
      </div>

      {!first && (
        <label className="block">
          <span className="label-caps mb-1.5 block">Current password</span>
          <input
            type="password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            autoComplete="current-password"
            className="input-field"
          />
        </label>
      )}

      <label className="mt-4 block">
        <span className="label-caps mb-1.5 block">New password</span>
        <input
          type="password"
          value={next}
          onChange={e => setNext(e.target.value)}
          autoComplete="new-password"
          placeholder="At least 6 characters"
          className="input-field"
        />
      </label>

      <label className="mt-4 block">
        <span className="label-caps mb-1.5 block">Confirm new password</span>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          autoComplete="new-password"
          className="input-field"
        />
      </label>

      {error && (
        <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn-primary mt-6 w-full"
        disabled={pending || !next || !confirm || (!first && !current)}
      >
        {pending ? "Saving…" : "Save password"}
        <span>→</span>
      </button>
    </form>
  );
}
