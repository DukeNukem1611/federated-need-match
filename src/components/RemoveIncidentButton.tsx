"use client";
// Super-admin action on the incident detail page: delete the incident (and its
// timeline). Two-click confirm, then redirects to the incident board.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RemoveIncidentButton({ incidentId }: { incidentId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/incidents/${incidentId}`, { method: "DELETE" });
    if (res.ok) {
      router.replace("/incidents");
      router.refresh();
    } else {
      setPending(false);
      setConfirming(false);
      setError("Failed to remove incident — try again.");
    }
  }

  if (!confirming) {
    return (
      <span className="flex flex-col items-start gap-1.5 lg:items-end">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md border border-red-500/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-600 transition-colors hover:bg-red-500/10"
        >
          Remove Incident
        </button>
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-700 disabled:opacity-50"
      >
        {pending ? "Removing…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="rounded-md border border-black/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
      >
        Cancel
      </button>
    </span>
  );
}
