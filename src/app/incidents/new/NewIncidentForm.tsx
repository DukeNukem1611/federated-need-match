"use client";
// Form that POSTs to /api/incidents and redirects into the new detail page.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { incidentCategoryEmoji, incidentCategoryLabel } from "@/lib/format";
import { LocationAutocomplete } from "@/components/LocationAutocomplete";
import { LocationPicker } from "@/components/LocationPicker";
import type { IncidentCategory } from "@prisma/client";

const CATEGORIES: IncidentCategory[] = [
  "FLOOD", "FIRE", "EARTHQUAKE", "STORM",
  "OUTBREAK", "ACCIDENT", "CONFLICT", "OTHER",
];

export function NewIncidentForm({
  ngos = [],
  lockedNgo,
  mapsApiKey,
}: {
  // Selectable list — only used when there's no NGO context to lock to.
  ngos?: { id: string; name: string }[];
  // When filing from an NGO's context (dashboard / volunteer page), the incident
  // is locked to that NGO so an organization can only file under its own name.
  lockedNgo?: { id: string; name: string };
  mapsApiKey?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Locked to the contextual NGO when present; otherwise the user picks from the
  // list (the only way to establish identity when there's no NGO context).
  const [createdByNgoId, setNgoId] = useState(lockedNgo?.id ?? ngos[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<IncidentCategory>("FLOOD");
  const [locationLabel, setLocationLabel] = useState("");
  // Exact coordinates from a typeahead pick (place mode). Null until the user
  // selects a suggestion; cleared the moment they edit the text again, so a
  // stale pick can never override what's now in the box.
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [inputType, setInputType] = useState<"place" | "coords">("place");
  const [showMap, setShowMap] = useState(false);
  const [latitude, setLatitude] = useState("12.9716");
  const [longitude, setLongitude] = useState("77.5946");
  const [radiusKm, setRadiusKm] = useState("2");
  const [description, setDescription] = useState("");

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setInputType("coords");
      },
      () => {
        setError("Unable to retrieve your location.");
      }
    );
  }

  // Map pin → exact coords + a reverse-geocoded label so the field isn't blank.
  async function handleMapPick(lat: number, lng: number) {
    setPickedLat(lat);
    setPickedLng(lng);
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (data?.label) setLocationLabel(data.label);
    } catch {
      // Reverse lookup failed — keep the coords; label can stay as-is.
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let finalLocationLabel = locationLabel.trim();
    if (inputType === "coords" && !finalLocationLabel) {
      if (latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude))) {
        finalLocationLabel = `${latitude}, ${longitude}`;
      }
    }
    
    if (!title.trim() || !finalLocationLabel || !createdByNgoId) {
      setError("Title, location, and posting NGO are required.");
      return;
    }
    
    let finalLat = parseFloat(latitude);
    let finalLng = parseFloat(longitude);
    
    if (inputType === "coords" && (isNaN(finalLat) || isNaN(finalLng))) {
      setError("Valid latitude and longitude are required when using coordinates.");
      return;
    }
    
    setPending(true);

    // Place mode: send the label without coords and let the server geocode it
    // (shared with need ingestion, with progressive fallback for specific spots).
    // Coords mode: send the explicit lat/lng the user entered.
    const usingCoords = inputType === "coords";
    const res = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        category,
        locationLabel: finalLocationLabel,
        // Coords mode → the typed lat/lng. Place mode → the exact pick if the
        // user chose a suggestion, else null so the server geocodes + falls back.
        latitude:  usingCoords ? finalLat : pickedLat,
        longitude: usingCoords ? finalLng : pickedLng,
        radiusKm:  parseFloat(radiusKm),
        description: description.trim() || null,
        createdByNgoId,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setError(error ?? "Failed to file incident");
      return;
    }
    const { incident } = await res.json();
    router.push(`/incidents/${incident.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="glass-panel relative overflow-hidden rounded-xl p-6 sm:p-8">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary-container/60 to-transparent" />

      <div className="grid gap-5">
        <div>
          <span className="label-caps mb-1.5 block">Filing NGO</span>
          {lockedNgo ? (
            <div className="flex items-center gap-2 rounded-md border border-black/10 bg-surface-container-low/60 px-3 py-2.5">
              <span className="text-primary-container">◆</span>
              <span className="text-sm font-medium text-on-surface">{lockedNgo.name}</span>
              <span className="ml-auto label-caps text-on-surface-variant">Filing as your NGO</span>
            </div>
          ) : (
            <select
              value={createdByNgoId}
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
        </div>

        <label>
          <span className="label-caps mb-1.5 block">Title</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. MG Road Flash Flood"
            className="input-field"
          />
        </label>

        <div>
          <span className="label-caps mb-1.5 block">Category</span>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => {
              const active = c === category;
              return (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                    active
                      ? "border-primary-container/50 bg-primary-container/10 text-primary"
                      : "border-black/10 bg-surface-container/50 text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <span>{incidentCategoryEmoji[c]}</span>
                  {incidentCategoryLabel[c]}
                </button>
              );
            })}
          </div>
        </div>

        {inputType === "place" ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label-caps block">Location</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  className="text-[11px] font-semibold uppercase text-emerald-600 hover:text-emerald-600"
                >
                  📍 Use Current Location
                </button>
                {mapsApiKey && (
                  <>
                    <div className="h-3 w-px bg-black/20"></div>
                    <button
                      type="button"
                      className={`text-[11px] font-semibold uppercase ${
                        showMap ? "text-primary-container" : "text-primary hover:text-primary-container"
                      }`}
                      onClick={() => setShowMap(s => !s)}
                    >
                      {showMap ? "Hide Map" : "📌 Pin on Map"}
                    </button>
                  </>
                )}
                <div className="h-3 w-px bg-black/20"></div>
                <button
                  type="button"
                  className="text-[11px] font-semibold uppercase text-primary hover:text-primary-container"
                  onClick={() => setInputType("coords")}
                >
                  Provide Coordinates Instead
                </button>
              </div>
            </div>
            <LocationAutocomplete
              value={locationLabel}
              onChange={label => {
                setLocationLabel(label);
                // Editing the text invalidates any previous exact pick.
                setPickedLat(null);
                setPickedLng(null);
              }}
              onPick={r => {
                setLocationLabel(r.matchedLabel);
                setPickedLat(r.lat);
                setPickedLng(r.lng);
              }}
              placeholder="e.g. MG Road, Bangalore"
              className="input-field"
            />
            <p className="mb-3 mt-1.5 text-[11px] leading-snug text-on-surface-variant">
              {pickedLat != null ? (
                <span className="text-emerald-600">
                  ✓ Exact location set ({pickedLat.toFixed(4)}, {pickedLng!.toFixed(4)})
                </span>
              ) : (
                <>Pick a suggestion or drop a pin on the map for an exact spot — otherwise we&rsquo;ll match the closest area we can find when you file.</>
              )}
            </p>
            {mapsApiKey && showMap && (
              <div className="mb-3">
                <LocationPicker
                  apiKey={mapsApiKey}
                  value={pickedLat != null && pickedLng != null ? { lat: pickedLat, lng: pickedLng } : null}
                  onChange={handleMapPick}
                />
              </div>
            )}
            <label>
              <span className="label-caps mb-1.5 block">Radius (km)</span>
              <input value={radiusKm} onChange={e => setRadiusKm(e.target.value)} className="input-field mono-data sm:w-1/3" />
            </label>
          </div>
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label-caps block">Location</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  className="text-[11px] font-semibold uppercase text-emerald-600 hover:text-emerald-600"
                >
                  📍 Use Current Location
                </button>
                <div className="h-3 w-px bg-black/20"></div>
                <button
                  type="button"
                  className="text-[11px] font-semibold uppercase text-primary hover:text-primary-container"
                  onClick={() => setInputType("place")}
                >
                  Provide Location by Place Name
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label>
                <span className="label-caps mb-1.5 block">Latitude</span>
                <input value={latitude} onChange={e => setLatitude(e.target.value)} className="input-field mono-data" />
              </label>
              <label>
                <span className="label-caps mb-1.5 block">Longitude</span>
                <input value={longitude} onChange={e => setLongitude(e.target.value)} className="input-field mono-data" />
              </label>
              <label>
                <span className="label-caps mb-1.5 block">Radius (km)</span>
                <input value={radiusKm} onChange={e => setRadiusKm(e.target.value)} className="input-field mono-data" />
              </label>
            </div>
          </div>
        )}

        <label>
          <span className="label-caps mb-1.5 block">Initial description</span>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            placeholder="What's happening? Any context the next NGO should know."
            className="input-field resize-none text-sm"
          />
        </label>

        {error && (
          <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-black/5 pt-5">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Filing…" : "File Incident"}
            <span>↗</span>
          </button>
        </div>
      </div>
    </form>
  );
}
