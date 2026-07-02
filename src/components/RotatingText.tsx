"use client";
// Cycles through short phrases with a soft cross-fade. Pure presentational
// flourish for the login hero; respects prefers-reduced-motion (shows the first
// phrase only).
import { useEffect, useState } from "react";

export function RotatingText({
  phrases,
  intervalMs = 3000,
  className,
}: {
  phrases: string[];
  intervalMs?: number;
  className?: string;
}) {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || phrases.length <= 1) return;

    const id = setInterval(() => {
      // fade out, swap, fade back in
      setVisible(false);
      setTimeout(() => {
        setI(prev => (prev + 1) % phrases.length);
        setVisible(true);
      }, 350);
    }, intervalMs);
    return () => clearInterval(id);
  }, [phrases, intervalMs]);

  return (
    <span
      className={`inline-block transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
      } ${className ?? ""}`}
    >
      {phrases[i]}
    </span>
  );
}
