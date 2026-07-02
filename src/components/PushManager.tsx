"use client";
// "Enable alerts" control: registers the service worker, requests notification
// permission, subscribes to Web Push, and stores the subscription server-side.
// Renders nothing when the browser doesn't support push or VAPID isn't set.
import { useEffect, useState } from "react";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// VAPID public key (base64url) → bytes, as required by PushManager.subscribe.
// Allocate an explicit ArrayBuffer so the result is a BufferSource the DOM types
// accept (a plain `new Uint8Array(n)` is typed over ArrayBufferLike).
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushManager() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window &&
      !!PUBLIC_KEY;
    setSupported(ok);
    if (!ok) return;
    setDenied(Notification.permission === "denied");
    navigator.serviceWorker
      .getRegistration()
      .then(reg => reg?.pushManager.getSubscription())
      .then(sub => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDenied(permission === "denied");
        setBusy(false);
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY!),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (res.ok) setSubscribed(true);
    } catch (e) {
      console.error("[push] enable failed:", e);
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      console.error("[push] disable failed:", e);
    }
    setBusy(false);
  }

  if (!supported) return null;

  if (denied) {
    return (
      <span
        className="hidden items-center gap-1.5 rounded-md border border-black/10 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant sm:inline-flex"
        title="Notifications are blocked in your browser settings."
      >
        🔕 Alerts blocked
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={subscribed ? disable : enable}
      disabled={busy}
      title={subscribed ? "Browser alerts are on — click to turn off" : "Get browser notifications even when this tab is closed"}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors disabled:opacity-50 ${
        subscribed
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
          : "border-primary-container/40 text-primary hover:bg-primary-container/10"
      }`}
    >
      {busy ? "…" : subscribed ? "🔔 Alerts on" : "🔔 Enable alerts"}
    </button>
  );
}
