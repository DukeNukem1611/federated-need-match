"use client";
// Profile picture for a user or an NGO. Read-only for most viewers; when
// `editable`, clicking it opens a file picker, compresses the image
// client-side, and PATCHes it straight to the given endpoint
// ({ [field]: dataUrl }), then refreshes the page data.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { compressToDataUrl } from "./PhotoUpload";

const AVATAR_MAX_EDGE = 512;

const SIZES = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-12 w-12 text-base",
  lg: "h-20 w-20 text-2xl",
} as const;

export function AvatarUpload({
  src,
  fallback,
  endpoint,
  field,
  editable = false,
  size = "md",
  shape = "circle",
  alt = "Profile picture",
}: {
  src: string | null;
  // Shown when there's no picture yet — initials for a person, ◆ for an NGO.
  fallback: string;
  endpoint?: string;
  field?: string;
  editable?: boolean;
  size?: keyof typeof SIZES;
  shape?: "circle" | "rounded";
  alt?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const radius = shape === "circle" ? "rounded-full" : "rounded-xl";

  async function handle(file: File) {
    if (!endpoint || !field) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await compressToDataUrl(file, AVATAR_MAX_EDGE);
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: dataUrl }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Upload failed" }));
        setError(error ?? "Upload failed");
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error("[avatar] upload failed:", err);
      setError("Couldn't read that image.");
    }
    setBusy(false);
  }

  const picture = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`${SIZES[size]} ${radius} border border-black/10 object-cover`} />
  ) : (
    <span
      className={`flex ${SIZES[size]} ${radius} items-center justify-center border border-black/10 bg-primary-container/10 font-semibold text-primary-container`}
    >
      {fallback}
    </span>
  );

  if (!editable) return picture;

  return (
    <span className="relative inline-block">
      <label
        className={`group relative block cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}
        title="Change picture"
      >
        {picture}
        <span
          className={`absolute inset-0 flex items-center justify-center ${radius} bg-black/45 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100`}
        >
          {busy ? "…" : "📷"}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handle(f);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <span className="absolute left-1/2 top-full z-20 mt-1 w-40 -translate-x-1/2 rounded-md border border-red-400/30 bg-surface px-2 py-1 text-center text-[10px] text-red-600 shadow-md">
          {error}
        </span>
      )}
    </span>
  );
}
