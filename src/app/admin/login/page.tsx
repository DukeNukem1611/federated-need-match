"use client";
// Password gate for the platform-admin console. Posts to /api/admin/login,
// which sets the session cookie; on success we navigate to wherever the
// middleware sent us from (defaults to /admin).
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/admin";

  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setPending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Login failed." }));
      setError(error ?? "Login failed.");
      return;
    }
    // Full reload so the middleware re-evaluates with the new cookie.
    router.replace(from);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="glass-panel w-full max-w-sm rounded-xl p-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="mb-4 inline-flex items-center rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fuchsia-700">
          Platform Admin
        </span>
        <h1 className="heading text-2xl font-bold text-on-surface">Restricted Console</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Enter the admin password to continue.
        </p>
      </div>

      <label className="block">
        <span className="label-caps mb-1.5 block">Password</span>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          placeholder="••••••••"
          className="input-field"
        />
      </label>

      {error && (
        <p className="mt-4 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary mt-6 w-full" disabled={pending || !password}>
        {pending ? "Verifying…" : "Unlock"}
        <span>→</span>
      </button>

      <Link
        href="/"
        className="mt-4 block text-center text-xs uppercase tracking-[0.1em] text-on-surface-variant hover:text-primary"
      >
        ← Back home
      </Link>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[600px] -translate-x-1/2 rounded-full bg-primary-container/10 blur-[140px]" />
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
