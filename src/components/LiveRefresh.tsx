"use client";
// Polls the current route at a fixed interval by calling router.refresh(),
// which re-runs the parent server component's data loaders without
// unmounting client components — so unsaved form state survives.
//
// Behaviour:
//   • Pauses when the tab is hidden (no point burning queries).
//   • Hard-refreshes once on visibility return so the user catches up
//     immediately after switching back.
//   • Renders a small "Live" pill so users know polling is active.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function LiveRefresh({
  intervalMs = 10_000,
  label = "Live",
}: {
  intervalMs?: number;
  label?: string;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const [lastTick, setLastTick] = useState<number>(Date.now());

  // Track tab visibility so we don't spin while the user is elsewhere.
  useEffect(() => {
    const onVis = () => {
      const isVisible = document.visibilityState === "visible";
      setVisible(isVisible);
      if (isVisible) {
        router.refresh();
        setLastTick(Date.now());
      }
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [router]);

  // Drive the polling loop only while the tab is visible.
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      router.refresh();
      setLastTick(Date.now());
    }, intervalMs);
    return () => clearInterval(id);
  }, [visible, intervalMs, router]);

  const seconds = Math.round(intervalMs / 1000);

  return (
    <span
      className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-200"
      title={`Auto-refreshing every ${seconds}s · last fetch ${new Date(lastTick).toLocaleTimeString()}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full bg-emerald-300 ${visible ? "animate-pulse-dot" : "opacity-40"}`}
      />
      {label} · {seconds}s
    </span>
  );
}
