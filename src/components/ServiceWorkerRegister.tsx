"use client";
// Registers the service worker on every visit so the app is installable as a
// PWA (installability requires an active SW, not just when "Enable alerts" is
// clicked). Renders nothing. PushManager also registers /sw.js — re-registering
// the same URL is a harmless no-op.
import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch(err => console.error("[sw] registration failed:", err));
    };
    // Wait until the page has loaded to avoid competing with initial render.
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
