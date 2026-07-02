"use client";
// Types `text` out character-by-character with a blinking caret. The full text
// is rendered invisibly underneath to reserve its wrapped height, so the layout
// doesn't jump as characters appear. Honors prefers-reduced-motion (shows the
// full text immediately, no caret).
import { useEffect, useState } from "react";

export function Typewriter({
  text,
  speed = 18,
  startDelay = 250,
  className,
}: {
  text: string;
  speed?: number;
  startDelay?: number;
  className?: string;
}) {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setCount(text.length);
      setDone(true);
      return;
    }

    let i = 0;
    let interval: ReturnType<typeof setInterval>;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        i++;
        setCount(i);
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(start);
      clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return (
    <span className={className}>
      <span className="relative inline-block">
        {/* Reserves the final wrapped height so nothing reflows while typing. */}
        <span aria-hidden className="invisible">
          {text}
        </span>
        {/* The visible, progressively-revealed copy. */}
        <span className="absolute inset-0" aria-label={text}>
          {text.slice(0, count)}
          <span
            className={`ml-0.5 inline-block w-[2px] -translate-y-[2px] align-middle text-primary-container ${
              done ? "animate-pulse" : ""
            }`}
            aria-hidden
          >
            ▌
          </span>
        </span>
      </span>
    </span>
  );
}
