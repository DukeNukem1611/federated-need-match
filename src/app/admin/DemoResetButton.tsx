"use client";
// Super-admin "restore the showroom" button. Wipes EVERYTHING and reloads the
// seed demo data — double confirm, with the second step spelling out the cost.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DemoResetButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/admin/reset-demo", { method: "POST" });
    setPending(false);
    setConfirming(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Reset failed" }));
      setError(error ?? "Reset failed");
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <div className="glass-panel rounded-xl border border-amber-400/30 p-6">
      <p className="label-caps text-amber-700">Danger Zone</p>
      <h3 className="heading mt-1 text-lg font-semibold text-on-surface">Reset demo data</h3>
      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
        Wipes <span className="font-semibold text-on-surface">everything</span> — all NGOs,
        accounts, incidents, needs, matches, photos, and notifications — and restores the
        canonical demo: 3 NGOs, 9 accounts (password <span className="mono-data">relief123</span>),
        and 2 sample incidents. Everyone is signed out of their user accounts.
      </p>

      <div className="mt-4">
        {!confirming ? (
          <button
            type="button"
            onClick={() => { setConfirming(true); setDone(false); }}
            className="rounded-md border border-amber-500/40 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700 transition-colors hover:bg-amber-500/10"
          >
            ↺ Reset demo data…
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-red-600">
              This destroys ALL current data. Sure?
            </span>
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-700 disabled:opacity-50"
            >
              {pending ? "Resetting…" : "Yes, wipe & reseed"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-md border border-black/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {done && (
        <p className="mt-3 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-700">
          ✓ Demo data restored. All accounts use <span className="mono-data">relief123</span>.
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
