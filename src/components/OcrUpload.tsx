"use client";
// Client-side OCR uploader. Loads tesseract.js dynamically (so it doesn't
// bloat the initial bundle) and hands the extracted text back to the parent
// via onText. Parents decide whether to append, replace, or ignore.
import { useState } from "react";

export function OcrUpload({
  onText,
  disabled,
  label = "Upload a photo",
  hint = "OCR extracts handwritten or printed text",
}: {
  onText: (extractedText: string) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = status !== null && status !== "done";

  async function handle(file: File) {
    setError(null);
    setStatus("Loading OCR engine…");
    setProgress(0);
    setPreview(URL.createObjectURL(file));

    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: m => {
          if (m.status) setStatus(m.status);
          if (typeof m.progress === "number") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();

      const extracted = data.text.trim().replace(/\s+/g, " ");
      if (!extracted) {
        setError("No text detected in image. Try a clearer photo.");
        setStatus("done");
      } else {
        setStatus("Refining with AI…");
        try {
          const refineRes = await fetch("/api/refine-ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: extracted }),
          });
          if (refineRes.ok) {
            const { refinedText } = await refineRes.json();
            onText(refinedText);
          } else {
            onText(extracted); // fallback to raw
          }
        } catch {
          onText(extracted); // fallback to raw
        }
        setStatus("done");
      }
    } catch (err) {
      console.error("[ocr] failed:", err);
      setError("OCR failed. You can still type the text manually.");
      setStatus(null);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-black/10 bg-surface-container-low/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-container/10 text-primary-container">
            <span className="heading text-lg">◳</span>
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface">{label}</p>
            <p className="text-[11px] text-on-surface-variant">{hint}</p>
          </div>
        </div>
        <label
          className={`btn-ghost cursor-pointer ${busy || disabled ? "pointer-events-none opacity-50" : ""}`}
        >
          <span>{busy ? "Reading…" : "Choose Image"}</span>
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

      {busy && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="label-caps text-primary-container">{status}</span>
            <span className="mono-data text-primary-container">{progress}%</span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-black/5">
            <div
              className="h-full bg-primary-container shadow-glow-cyan transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {preview && !busy && (
        <div className="mt-3 flex items-center gap-3 rounded-md border border-black/5 bg-surface-container/60 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="uploaded"
            className="h-12 w-12 rounded border border-black/10 object-cover grayscale"
          />
          <p className="text-[11px] text-on-surface-variant">
            Text extracted — review and edit before submitting if needed.
          </p>
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
