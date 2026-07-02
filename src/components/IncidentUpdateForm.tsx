"use client";
// Posts a new update to an incident's timeline. Any NGO can author one —
// that's the whole point of the shared knowledge base. Supports both
// typed entries and OCR-extracted text from a field photo (sign, notice,
// handwritten log, etc.).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateKindStyle } from "@/lib/format";
import { OcrUpload } from "./OcrUpload";
import { PhotoUpload } from "./PhotoUpload";
import type { UpdateKind } from "@prisma/client";

type Ngo = { id: string; name: string };

const KIND_HINT: Record<UpdateKind, string> = {
  INFO:       "General context or advisory.",
  HAZARD:     "Danger, blocked route, unsafe area.",
  NEED:       "People on site need something specific.",
  RESOURCE:   "Something you have or are providing.",
  STATUS:     "State change (e.g. water receding).",
  RESOLUTION: "Closing out the incident.",
};

const KIND_ORDER: UpdateKind[] = [
  "INFO", "HAZARD", "NEED", "RESOURCE", "STATUS", "RESOLUTION",
];

export function IncidentUpdateForm({
  incidentId,
  ngos,
  defaultNgoId,
}: {
  incidentId: string;
  ngos: Ngo[];
  defaultNgoId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // One NGO in the list = identity is fixed (session-locked); no dropdown.
  const lockedNgo = ngos.length === 1 ? ngos[0] : null;
  const [ngoId, setNgoId] = useState(
    lockedNgo?.id ??
      (defaultNgoId && ngos.some(n => n.id === defaultNgoId) ? defaultNgoId : ngos[0]?.id ?? ""),
  );
  const [kind, setKind] = useState<UpdateKind>("INFO");
  const [body, setBody] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A photo can stand alone — the body then acts as an optional caption.
  const canSubmit = (body.trim().length > 0 || photo !== null) && !!ngoId;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;

    const res = await fetch(`/api/incidents/${incidentId}/updates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ngoId, kind, body, photoData: photo ?? undefined }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setError(error ?? "Failed to post update");
      return;
    }
    setBody("");
    setKind("INFO");
    setPhoto(null);
    startTransition(() => router.refresh());
  }

  const style = updateKindStyle[kind];

  return (
    <form onSubmit={submit} className="glass-panel relative overflow-hidden rounded-xl p-6">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary-container/60 to-transparent" />

      <div className="mb-4">
        <p className="label-caps text-surface-tint">Append Update</p>
        <h3 className="heading mt-1 text-xl font-semibold text-on-surface">
          Post to Timeline
        </h3>
        <p className="mt-1 text-xs text-on-surface-variant">
          Anyone reading this incident later will see what you wrote — be specific.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="label-caps mb-1.5 block">Posting as</span>
          {lockedNgo ? (
            <span className="inline-flex h-[42px] items-center gap-2 rounded-md border border-primary-container/30 bg-primary-container/10 px-3 text-sm font-medium text-primary">
              ◆ {lockedNgo.name}
            </span>
          ) : (
            <select
              value={ngoId}
              onChange={e => setNgoId(e.target.value)}
              className="input-field"
            >
              {ngos.map(n => (
                <option key={n.id} value={n.id} className="bg-surface-container-low text-on-surface">
                  {n.name}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="block">
          <span className="label-caps mb-1.5 block">Kind</span>
          <div className="flex flex-wrap gap-1.5">
            {KIND_ORDER.map(k => {
              const s = updateKindStyle[k];
              const active = k === kind;
              return (
                <button
                  type="button"
                  key={k}
                  onClick={() => setKind(k)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                    active
                      ? s.chip + " ring-1 ring-black/20"
                      : "border-black/10 bg-surface-container/50 text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <span>{s.icon}</span>
                  {s.label}
                </button>
              );
            })}
          </div>
        </label>
      </div>

      <p className="mt-3 text-[11px] text-on-surface-variant">{KIND_HINT[kind]}</p>

      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={3}
        placeholder={
          photo
            ? "Optional caption for your photo…"
            : kind === "HAZARD"
              ? "e.g. MG Road blocked between Junction 4 and Trinity. Divert via Residency Road."
              : kind === "NEED"
                ? "e.g. 3 people near the underpass need medical attention."
                : kind === "RESOURCE"
                  ? "e.g. 200 hot meals staged at the community center kitchen."
                  : "Describe what's happening or what you're seeing on site…"
        }
        className="input-field mt-4 resize-none text-sm"
      />

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <PhotoUpload
          disabled={pending}
          value={photo}
          onChange={setPhoto}
          label="Attach a field photo"
          hint="The image is posted to the timeline — caption above is optional"
        />
        <OcrUpload
          disabled={pending}
          label="Extract text from a photo"
          hint="Sign, notice, handwritten log — text gets pulled into the update"
          onText={extracted =>
            setBody(prev => (prev ? `${prev}\n${extracted}` : extracted))
          }
        />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-4">
        <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${style.chip}`}>
          <span>{style.icon}</span>
          {style.label}
        </span>
        <button type="submit" className="btn-primary" disabled={pending || !canSubmit}>
          {pending ? "Posting…" : photo && !body.trim() ? "Post Photo" : "Post Update"}
          <span>↗</span>
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
