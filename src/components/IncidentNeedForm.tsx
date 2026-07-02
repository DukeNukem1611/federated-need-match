"use client";
// Files a ReportedNeed tied to an incident. The location defaults to the
// incident's, but can be set precisely — typeahead pick or map pin — instead of
// being guessed from keywords in the report text. Posts to /api/ingest, so the
// need shows up under "Linked Needs" and — when shared — on the federated map.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import { LocationPicker } from "@/components/LocationPicker";
import { PhotoUpload } from "@/components/PhotoUpload";

export function IncidentNeedForm({
  incidentId,
  incidentLat,
  incidentLng,
  incidentLocationLabel,
  ngos,
  defaultNgoId,
  mapsApiKey,
}: {
  incidentId: string;
  incidentLat: number;
  incidentLng: number;
  incidentLocationLabel?: string;
  ngos: { id: string; name: string }[];
  defaultNgoId?: string;
  mapsApiKey?: string;
}) {
  const router = useRouter();
  // One NGO in the list = identity is fixed (session-locked); no dropdown.
  const lockedNgo = ngos.length === 1 ? ngos[0] : null;
  const initialNgoId =
    lockedNgo?.id ??
    (defaultNgoId && ngos.some(n => n.id === defaultNgoId)
      ? defaultNgoId
      : ngos[0]?.id ?? "");

  const [open, setOpen] = useState(false);
  const [ngoId, setNgoId] = useState(initialNgoId);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [isShared, setIsShared] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Location — defaults to the incident's spot; the user can override it.
  const [locLabel, setLocLabel] = useState(incidentLocationLabel ?? "");
  const [pickedLat, setPickedLat] = useState<number | null>(incidentLat);
  const [pickedLng, setPickedLng] = useState<number | null>(incidentLng);
  const [showMap, setShowMap] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const [latStr, setLatStr] = useState(String(incidentLat));
  const [lngStr, setLngStr] = useState(String(incidentLng));

  const atIncident = pickedLat === incidentLat && pickedLng === incidentLng;

  function resetToIncident() {
    setLocLabel(incidentLocationLabel ?? "");
    setPickedLat(incidentLat);
    setPickedLng(incidentLng);
    setLatStr(String(incidentLat));
    setLngStr(String(incidentLng));
  }

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!text.trim() || !ngoId) {
      setError("A need description and filing NGO are required.");
      return;
    }
    setPending(true);
    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ngoId,
        rawText: text,
        // Explicit location wins over keyword extraction. Coords are sent when
        // we have them (pick/pin/default); otherwise the typed label is geocoded.
        latitude: pickedLat,
        longitude: pickedLng,
        locationLabel: locLabel.trim() || undefined,
        // Reporter coords remain the ultimate fallback.
        reporterLat: incidentLat,
        reporterLng: incidentLng,
        isShared,
        incidentId,
        photoData: photo ?? undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setError(error ?? "Failed to file need");
      return;
    }
    setText("");
    setPhoto(null);
    router.refresh();
  }

  return (
    <div className="mt-4 border-t border-black/5 pt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-ghost w-full text-xs"
        >
          + File a Need
        </button>
      ) : (
        <form onSubmit={submit} className="grid gap-3">
          <label>
            <span className="label-caps mb-1.5 block">Filing NGO</span>
            {lockedNgo ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-primary-container/30 bg-primary-container/10 px-2.5 py-1.5 text-xs font-medium text-primary">
                ◆ {lockedNgo.name}
              </span>
            ) : (
              <select
                value={ngoId}
                onChange={e => setNgoId(e.target.value)}
                className="input-field text-sm"
              >
                {ngos.map(n => (
                  <option key={n.id} value={n.id} className="bg-surface-container-low text-on-surface">
                    {n.name}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label>
            <span className="label-caps mb-1.5 block">Need</span>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={3}
              placeholder="e.g. 12 people need drinking water and blankets"
              className="input-field resize-none text-sm"
            />
          </label>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="label-caps block">Location</span>
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
                {!atIncident && (
                  <>
                    <div className="h-3 w-px bg-black/20" />
                    <button
                      type="button"
                      onClick={resetToIncident}
                      className="text-[11px] font-semibold uppercase text-on-surface-variant hover:text-on-surface"
                    >
                      Reset
                    </button>
                  </>
                )}
              </div>
            </div>

            <LocationAutocomplete
              value={locLabel}
              onChange={label => {
                setLocLabel(label);
                // Free typing invalidates the exact pin/pick — server will
                // geocode the typed label on submit.
                setPickedLat(null);
                setPickedLng(null);
              }}
              onPick={r => {
                setLocLabel(r.matchedLabel);
                setPickedLat(r.lat);
                setPickedLng(r.lng);
              }}
              placeholder="Defaults to incident location"
              className="input-field text-sm"
            />
            <p className="mt-1 text-[11px] leading-snug text-on-surface-variant">
              {pickedLat != null ? (
                atIncident ? (
                  <span className="text-on-surface-variant">
                    Using incident location ({pickedLat.toFixed(4)}, {pickedLng!.toFixed(4)})
                  </span>
                ) : (
                  <span className="text-emerald-600">
                    ✓ Exact location set ({pickedLat.toFixed(4)}, {pickedLng!.toFixed(4)})
                  </span>
                )
              ) : (
                <>Pick a suggestion or drop a pin for an exact spot — otherwise we&rsquo;ll match the closest area we can find.</>
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
                  fallbackCenter={{ lat: incidentLat, lng: incidentLng }}
                />
              </div>
            )}
          </div>

          <PhotoUpload
            disabled={pending}
            value={photo}
            onChange={setPhoto}
            label="Attach a field photo"
            hint="Shown with the need so responders see the situation"
          />

          <label className="flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant">
            <input
              type="checkbox"
              checked={isShared}
              onChange={e => setIsShared(e.target.checked)}
              className="h-4 w-4 rounded border-black/20 bg-surface-container-low text-primary-container focus:ring-primary-container"
            />
            Share with federated network
          </label>

          {error && (
            <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn-primary text-xs">
              {pending ? "Filing…" : "File Need"}
              <span>↗</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
