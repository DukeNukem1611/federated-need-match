// Small shared presentational bits for lively, consistent section headers.
// Server components (no hooks) so they can drop into any page.
import type { ReactNode } from "react";

// An eyebrow label with a pulsing live dot.
export function LiveEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="label-caps flex items-center gap-2 text-surface-tint">
      <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-primary-container" />
      {children}
    </p>
  );
}

// A thin gradient underline with a glint that continuously scans across it.
export function ScanLine({ className = "mt-2 w-24" }: { className?: string }) {
  return (
    <span
      className={`block h-[2px] rounded-full bg-gradient-to-r from-primary-container/0 via-primary-container to-primary-container/0 bg-[length:200%_auto] animate-shimmer ${className}`}
    />
  );
}

// A hover-only light sweep for cards. Place inside a `group` + `overflow-hidden`
// relatively-positioned card.
export function HoverShine() {
  return (
    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary-container/15 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
  );
}
