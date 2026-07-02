"use client";
// Form that POSTs raw field text to /api/ingest. On success it triggers
// router.refresh() so the parent server component re-queries the needs list.
//
// Reports can be typed, pasted, or lifted from a photo via the shared
// OcrUpload component (tesseract.js, loaded dynamically). Location is detected
// from the report text by default, but can be set precisely via a typeahead
// pick or a map pin.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OcrUpload } from "./OcrUpload";
import { PhotoUpload } from "./PhotoUpload";
import { LocationAutocomplete } from "./LocationAutocomplete";
import { LocationPicker } from "./LocationPicker";
import { addToOutbox } from "@/lib/outbox";

const SAMPLES = [
  "Emergency: 3 people injured on MG Road, need doctor immediately",
  "Found 5 families needing blankets on Elm Street, urgent",
  "20 children hungry near community center, need meals today",
];

export function IngestForm({
  ngoId,
  defaultLat,
  defaultLng,
  mapsApiKey,
}: {
  ngoId: string;
  defaultLat: number;
  defaultLng: number;
  mapsApiKey?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [isShared, setIsShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [pending, startTransition] = useTransition();

  // Optional explicit location. Null/empty by default → the server detects the
  // location from the report text (Gemini parse, then geocode). A pick or pin
  // overrides that with exact coordinates.
  const [locLabel, setLocLabel] = useState("");
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const [latStr, setLatStr] = useState("");
  const [lngStr, setLngStr] = useState("");

  async function handleMapPick(lat: number, lng: number) {
    setPickedLat(lat);
    setPickedLng(lng);
    setLatStr(lat.toFixed(6));
    setLngStr(lng.toFixed(6));
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (data?.label) setLocLabel(data.label);
    } catch {
      /* keep coords; label can stay */
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => handleMapPick(pos.coords.latitude, pos.coords.longitude),
      () => setError("Unable to retrieve your location."),
    );
  }

  // Manual coords: update the picked point as soon as both fields are valid.
  function onCoordChange(which: "lat" | "lng", raw: string) {
    const lat = which === "lat" ? raw : latStr;
    const lng = which === "lng" ? raw : lngStr;
    if (which === "lat") setLatStr(raw);
    else setLngStr(raw);
    const nLat = parseFloat(lat);
    const nLng = parseFloat(lng);
    if (Number.isFinite(nLat) && Number.isFinite(nLng)) {
      setPickedLat(nLat);
      setPickedLng(nLng);
    }
  }

  function clearLocation() {
    setLocLabel("");
    setPickedLat(null);
    setPickedLng(null);
    setLatStr("");
    setLngStr("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setQueuedOffline(false);
    if (!text.trim()) return;

    const payload = {
      ngoId,
      rawText: text,
      // Explicit location wins; when omitted, the server falls back to
      // detecting it from the report text, then to the NGO's coords.
      latitude: pickedLat,
      longitude: pickedLng,
      locationLabel: locLabel.trim() || undefined,
      reporterLat: defaultLat,
      reporterLng: defaultLng,
      isShared,
      photoData: photo ?? undefined,
    };

    function resetForm() {
      setText("");
      setPhoto(null);
      setIsShared(false);
      clearLocation();
    }

    // No connection? Queue the report locally — OutboxSync sends it the
    // moment the device is back online.
    async function queueOffline() {
      try {
        await addToOutbox("/api/ingest", payload);
        resetForm();
        setQueuedOffline(true);
      } catch {
        setError("You're offline and the report couldn't be queued. Keep this tab open and retry.");
      }
    }

    if (!navigator.onLine) {
      await queueOffline();
      return;
    }

    let res: Response;
    try {
      res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // fetch itself failed — flaky network counts as offline.
      await queueOffline();
      return;
    }
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setError(error ?? "Ingest failed");
      return;
    }
    resetForm();
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={submit} className="glass-panel relative overflow-hidden rounded-xl p-6">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary-container/60 to-transparent" />

      <div className="mb-4">
        <p className="label-caps text-surface-tint">Ingest Module</p>
        <h3 className="heading mt-1 text-xl font-semibold text-on-surface">
          New Field Report
        </h3>
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
            className="rounded-full border border-black/10 bg-surface-container-high/40 px-3 py-1 text-[11px] text-on-surface-variant transition-colors hover:border-primary-container/40 hover:text-primary"
          >
            {s.length > 40 ? s.slice(0, 40) + "…" : s}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <PhotoUpload
          disabled={pending}
          value={photo}
          onChange={setPhoto}
          label="Attach a field photo"
          hint="Shown with the need so responders see the situation"
        />
        <OcrUpload
          disabled={pending}
          label="Extract text from a photo"
          onText={extracted =>
            setText(prev => (prev ? `${prev}\n${extracted}` : extracted))
          }
        />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="label-caps block">Location (optional)</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={useCurrentLocation}
              className="text-[11px] font-semibold uppercase text-emerald-600 hover:text-emerald-600"
            >
              📍 Current
            </button>
            {mapsApiKey && (
              <>
                <div className="h-3 w-px bg-black/20" />
                <button
                  type="button"
                  onClick={() => setShowMap(s => !s)}
                  className={`text-[11px] font-semibold uppercase ${
                    showMap ? "text-primary-container" : "text-primary hover:text-primary-container"
                  }`}
                >
                  {showMap ? "Hide Map" : "📌 Map"}
                </button>
              </>
            )}
            <div className="h-3 w-px bg-black/20" />
            <button
              type="button"
              onClick={() => setShowCoords(s => !s)}
              className={`text-[11px] font-semibold uppercase ${
                showCoords ? "text-primary-container" : "text-primary hover:text-primary-container"
              }`}
            >
              {showCoords ? "Hide Coords" : "Coords"}
            </button>
            {pickedLat != null && (
              <>
                <div className="h-3 w-px bg-black/20" />
                <button
                  type="button"
                  onClick={clearLocation}
                  className="text-[11px] font-semibold uppercase text-on-surface-variant hover:text-on-surface"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        <LocationAutocomplete
          value={locLabel}
          onChange={label => {
            setLocLabel(label);
            // Free typing invalidates an exact pin/pick.
            setPickedLat(null);
            setPickedLng(null);
          }}
          onPick={r => {
            setLocLabel(r.matchedLabel);
            setPickedLat(r.lat);
            setPickedLng(r.lng);
          }}
          placeholder="Detected from the report text — pick or pin to override"
          className="input-field text-sm"
        />
        <p className="mt-1 text-[11px] leading-snug text-on-surface-variant">
          {pickedLat != null ? (
            <span className="text-emerald-600">
              ✓ Exact location set ({pickedLat.toFixed(4)}, {pickedLng!.toFixed(4)})
            </span>
          ) : (
            <>Leave blank to detect the location from the report text, or use Current / Map / Coords / a suggestion for an exact spot.</>
          )}
        </p>

        {showCoords && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label>
              <span className="label-caps mb-1 block">Latitude</span>
              <input
                value={latStr}
                onChange={e => onCoordChange("lat", e.target.value)}
                placeholder="12.9716"
                className="input-field mono-data text-sm"
              />
            </label>
            <label>
              <span className="label-caps mb-1 block">Longitude</span>
              <input
                value={lngStr}
                onChange={e => onCoordChange("lng", e.target.value)}
                placeholder="77.5946"
                className="input-field mono-data text-sm"
              />
            </label>
          </div>
        )}

        {mapsApiKey && showMap && (
          <div className="mt-2">
            <LocationPicker
              apiKey={mapsApiKey}
              value={pickedLat != null && pickedLng != null ? { lat: pickedLat, lng: pickedLng } : null}
              onChange={handleMapPick}
              fallbackCenter={{ lat: defaultLat, lng: defaultLng }}
            />
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-black/5 pt-4 sm:flex-row sm:items-center">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-on-surface-variant">
          <input
            type="checkbox"
            checked={isShared}
            onChange={e => setIsShared(e.target.checked)}
            className="h-4 w-4 rounded border-black/20 bg-surface-container-low text-primary-container focus:ring-primary-container"
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
        <p className="mt-3 rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {queuedOffline && (
        <p className="mt-3 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-800">
          📡 You&rsquo;re offline — the report was queued on this device and will be
          sent automatically when you&rsquo;re back online.
        </p>
      )}
    </form>
  );
}
