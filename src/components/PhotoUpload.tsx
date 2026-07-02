"use client";
// Attach a field photo (the picture itself, not OCR text — see OcrUpload for
// that). Downscales/compresses client-side via canvas so what we store in the
// database stays small, then hands the JPEG data URL back to the parent.
import { useState } from "react";

// Longest edge after downscale; ~0.8 JPEG quality keeps typical phone photos
// well under the server's size cap while staying perfectly readable.
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.8;
// Mirror of the server cap (2M chars ≈ 1.5 MB decoded).
const MAX_DATA_URL_CHARS = 2_000_000;

// Shared by AvatarUpload (smaller maxEdge for profile pictures).
export async function compressToDataUrl(file: File, maxEdge = MAX_EDGE): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export function PhotoUpload({
  value,
  onChange,
  disabled,
  label = "Attach a photo of the situation",
  hint = "The image itself is shared — no text extraction",
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await compressToDataUrl(file);
      if (dataUrl.length > MAX_DATA_URL_CHARS) {
        setError("Photo is too large even after compression — try a smaller image.");
      } else {
        onChange(dataUrl);
      }
    } catch (err) {
      console.error("[photo] compress failed:", err);
      setError("Couldn't read that image. Try a different file.");
    }
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-dashed border-black/10 bg-surface-container-low/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-container/10 text-primary-container">
            <span className="heading text-lg">🖼</span>
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface">{label}</p>
            <p className="text-[11px] text-on-surface-variant">{hint}</p>
          </div>
        </div>
        <label
          className={`btn-ghost cursor-pointer ${busy || disabled ? "pointer-events-none opacity-50" : ""}`}
        >
          <span>{busy ? "Processing…" : value ? "Replace" : "Choose Photo"}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy || disabled}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handle(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {value && (
        <div className="mt-3 flex items-center gap-3 rounded-md border border-black/5 bg-surface-container/60 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="attached"
            className="h-16 w-16 rounded border border-black/10 object-cover"
          />
          <p className="flex-1 text-[11px] text-on-surface-variant">
            Photo attached — it will be visible to every NGO that opens this.
          </p>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={busy || disabled}
            className="rounded-md border border-red-500/30 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-600 transition-colors hover:bg-red-500/10"
          >
            Remove
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-700">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
