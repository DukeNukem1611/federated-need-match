"use client";
// Login form with a Volunteer | NGO segmented toggle. The toggle is passed to
// the API as `expectedRole` so the two flows stay distinct (a volunteer can't
// sign in on the NGO tab and vice-versa). On success we route by role, or to
// the change-password screen when the account still has a default password.
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "VOLUNTEER" | "ADMIN";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from");

  const [mode, setMode] = useState<Mode>("VOLUNTEER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, expectedRole: mode, rememberMe }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);

    if (!res.ok) {
      setError(data?.error ?? "Login failed.");
      return;
    }

    if (data.mustChangePassword) {
      router.replace("/account/password?first=1");
      router.refresh();
      return;
    }

    const dest =
      from && from.startsWith("/")
        ? from
        : data.role === "ADMIN"
          ? `/dashboard/${data.ngoId}`
          : `/user/${data.userId}`;
    router.replace(dest);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="w-full">
      {/* Volunteer | NGO toggle */}
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-black/10 bg-surface-container/60 p-1">
        {(["VOLUNTEER", "ADMIN"] as Mode[]).map(m => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-all ${
                active
                  ? "bg-primary-container text-on-primary shadow-glow-cyan"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {m === "VOLUNTEER" ? "Volunteer" : "NGO"}
            </button>
          );
        })}
      </div>

      <label className="block">
        <span className="label-caps mb-1.5 block">Email</span>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoFocus
          autoComplete="email"
          placeholder={mode === "ADMIN" ? "admin@yourngo.org" : "you@yourngo.org"}
          className="input-field"
        />
      </label>

      <label className="mt-4 block">
        <span className="label-caps mb-1.5 block">Password</span>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
          className="input-field"
        />
      </label>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant">
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={e => setRememberMe(e.target.checked)}
          className="h-4 w-4 rounded border-black/20 bg-surface-container-low text-primary-container focus:ring-primary-container"
        />
        Keep me signed in for 30 days
      </label>

      {error && (
        <p className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn-primary mt-6 w-full"
        disabled={pending || !email || !password}
      >
        {pending ? "Signing in…" : `Sign in as ${mode === "ADMIN" ? "NGO" : "Volunteer"}`}
        <span>→</span>
      </button>

      <p className="mt-5 text-center text-xs text-on-surface-variant">
        Platform administrator?{" "}
        <a href="/admin/login" className="font-semibold text-primary hover:text-primary-container">
          Admin console →
        </a>
      </p>
    </form>
  );
}
