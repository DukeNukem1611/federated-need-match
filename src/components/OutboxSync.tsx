"use client";
// Flushes the offline outbox (reports queued while disconnected) whenever the
// browser comes back online, and shows a small floating badge while anything
// is still pending. Mounted once in the root layout.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { listOutbox, removeFromOutbox, outboxCount, OUTBOX_EVENT } from "@/lib/outbox";

export function OutboxSync() {
  const router = useRouter();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const flushing = useRef(false);

  const refreshCount = useCallback(() => {
    outboxCount().then(setPending).catch(() => {});
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    flushing.current = true;
    setSyncing(true);
    let sent = 0;
    try {
      const queued = await listOutbox();
      for (const item of queued) {
        try {
          const res = await fetch(item.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload),
          });
          if (res.ok) {
            await removeFromOutbox(item.id!);
            sent++;
          } else if (res.status === 401 || res.status === 403 || res.status >= 500) {
            // Not signed in / server trouble — keep the queue, retry later.
            break;
          } else {
            // Permanent rejection (validation): drop it so one bad report
            // can't block the rest of the queue forever.
            console.warn("[outbox] dropping rejected report", await res.text());
            await removeFromOutbox(item.id!);
          }
        } catch {
          break; // still offline / flaky — try again on the next 'online'
        }
      }
    } finally {
      flushing.current = false;
      setSyncing(false);
      refreshCount();
      if (sent > 0) router.refresh();
    }
  }, [refreshCount, router]);

  useEffect(() => {
    refreshCount();
    flush(); // catch anything left over from a previous visit
    window.addEventListener("online", flush);
    window.addEventListener(OUTBOX_EVENT, refreshCount);
    return () => {
      window.removeEventListener("online", flush);
      window.removeEventListener(OUTBOX_EVENT, refreshCount);
    };
  }, [flush, refreshCount]);

  if (pending === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2">
      <div className="flex items-center gap-2.5 rounded-full border border-amber-400/40 bg-surface px-4 py-2 text-xs text-amber-800 shadow-lg">
        <span className={`h-2 w-2 rounded-full ${syncing ? "animate-pulse-dot bg-emerald-400" : "bg-amber-400"}`} />
        {syncing
          ? `Syncing ${pending} queued report${pending > 1 ? "s" : ""}…`
          : `${pending} report${pending > 1 ? "s" : ""} queued offline — will send automatically`}
        {!syncing && (
          <button
            type="button"
            onClick={flush}
            className="font-semibold uppercase tracking-[0.08em] text-amber-700 hover:text-amber-900"
          >
            Retry now
          </button>
        )}
      </div>
    </div>
  );
}
