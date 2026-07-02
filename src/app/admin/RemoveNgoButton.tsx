"use client";
// Super-admin action: delete an NGO (and everything it owns). Two-click confirm
// to avoid accidental removal of a whole organization.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RemoveNgoButton({ ngoId, ngoName }: { ngoId: string; ngoName: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/ngos/${ngoId}`, { method: "DELETE" });
    setPending(false);
    if (res.ok) {
      router.refresh();
    } else {
      setConfirming(false);
      setError(`Failed to remove ${ngoName}.`);
    }
  }

  if (!confirming) {
    return (
      <span className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md border border-red-500/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-600 transition-colors hover:bg-red-500/10"
        >
          Remove
        </button>
        {error && <span className="text-[10px] text-red-600">{error}</span>}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-700 disabled:opacity-50"
      >
        {pending ? "Removing…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="rounded-md border border-black/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant"
      >
        Cancel
      </button>
    </span>
  );
}
