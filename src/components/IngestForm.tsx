"use client";
// Form that POSTs raw field text to /api/ingest. On success it triggers
// router.refresh() so the parent server component re-queries the needs list.
//
// Reports can be typed, pasted, or lifted from a photo via the shared
// OcrUpload component (tesseract.js, loaded dynamically).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OcrUpload } from "./OcrUpload";

const SAMPLES = [
  "Emergency: 3 people injured on MG Road, need doctor immediately",
  "Found 5 families needing blankets on Elm Street, urgent",
  "20 children hungry near community center, need meals today",
];

export function IngestForm({
  ngoId,
  defaultLat,
  defaultLng,
}: {
  ngoId: string;
  defaultLat: number;
  defaultLng: number;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!text.trim()) return;

    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ngoId,
        rawText: text,
        reporterLat: defaultLat,
        reporterLng: defaultLng,
        isShared,
      }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setError(error ?? "Ingest failed");
      return;
    }
    setText("");
    setIsShared(false);
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={submit} className="glass-panel relative overflow-hidden rounded-xl p-6">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary-container/60 to-transparent" />

      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="label-caps text-surface-tint">Ingest Module</p>
          <h3 className="heading mt-1 text-xl font-semibold text-on-surface">
            New Field Report
          </h3>
        </div>
        <span className="mono-data rounded-md border border-white/10 bg-surface-container/60 px-2.5 py-1 text-[11px] uppercase tracking-wider text-primary-container">
          Mock LLM
        </span>
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={4}
        placeholder="e.g. Emergency: 3 people injured on MG Road, need doctor immediately"
        className="input-field resize-none text-sm"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="label-caps">Try:</span>
        {SAMPLES.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setText(s)}
            className="rounded-full border border-white/10 bg-surface-container-high/40 px-3 py-1 text-[11px] text-on-surface-variant transition-colors hover:border-primary-container/40 hover:text-primary"
          >
            {s.length > 40 ? s.slice(0, 40) + "…" : s}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <OcrUpload
          disabled={pending}
          onText={extracted =>
            setText(prev => (prev ? `${prev}\n${extracted}` : extracted))
          }
        />
      </div>

      <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-white/5 pt-4 sm:flex-row sm:items-center">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant">
          <input
            type="checkbox"
            checked={isShared}
            onChange={e => setIsShared(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-surface-container-low text-primary-container focus:ring-primary-container"
          />
          Share with federated network
        </label>
        <button
          type="submit"
          disabled={pending || !text.trim()}
          className="btn-primary"
        >
          {pending ? "Saving…" : "Ingest Report"}
          <span>↗</span>
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
    </form>
  );
}
