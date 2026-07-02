"use client";
// Displays a photo attached to an update or need: thumbnail by default,
// click to expand in a full-screen lightbox (click anywhere / Esc to close).
import { useEffect, useState } from "react";

export function AttachedPhoto({ src, alt = "Field photo" }: { src: string; alt?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Click to enlarge"
        className="group/photo mt-2 block overflow-hidden rounded-md border border-black/10"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="max-h-48 w-auto transition-transform duration-300 group-hover/photo:scale-[1.02]"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-lg shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white transition-colors hover:bg-white/20"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
