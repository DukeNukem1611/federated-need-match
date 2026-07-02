"use client";
// "Install app" affordance for the PWA.
//  - Android / Chrome / Edge / desktop: captures the `beforeinstallprompt`
//    event and shows a button that fires the native install prompt.
//  - iOS Safari (no such event): shows a button that reveals a short
//    "Share → Add to Home Screen" hint, since iOS has no programmatic install.
//  - Hidden entirely once the app is already installed (standalone display).
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    // Already running as an installed app? Don't offer install.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari exposes this non-standard flag when launched from home screen.
      (window.navigator as any).standalone === true;
    if (standalone) {
      setInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) && /safari/.test(ua) && !/crios|fxios/.test(ua);
    setIsIos(ios);

    const onPrompt = (e: Event) => {
      e.preventDefault(); // stash it; we trigger it from our own button
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null); // the event can only be used once
  }

  if (installed) return null;

  // iOS: no programmatic prompt — offer a hint toggle.
  if (isIos) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowIosHint(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary-container/40 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary transition-colors hover:bg-primary-container/10"
        >
          📲 Install app
        </button>
        {showIosHint && (
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-black/10 bg-surface p-3 text-xs leading-relaxed text-on-surface shadow-lg">
            To install on iPhone/iPad: tap the{" "}
            <span className="font-semibold">Share</span> icon in Safari, then{" "}
            <span className="font-semibold">“Add to Home Screen.”</span>
          </div>
        )}
      </div>
    );
  }

  // Android / desktop: only show once the browser says it's installable.
  if (!promptEvent) return null;

  return (
    <button
      type="button"
      onClick={install}
      title="Install this app to your device"
      className="inline-flex items-center gap-1.5 rounded-md border border-primary-container/40 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary transition-colors hover:bg-primary-container/10"
    >
      📲 Install app
    </button>
  );
}
