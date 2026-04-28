"use client";
// Form that POSTs to /api/incidents and redirects into the new detail page.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { incidentCategoryEmoji, incidentCategoryLabel } from "@/lib/format";
import type { IncidentCategory } from "@prisma/client";

const CATEGORIES: IncidentCategory[] = [
  "FLOOD", "FIRE", "EARTHQUAKE", "STORM",
  "OUTBREAK", "ACCIDENT", "CONFLICT", "OTHER",
];

export function NewIncidentForm({ ngos }: { ngos: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createdByNgoId, setNgoId] = useState(ngos[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<IncidentCategory>("FLOOD");
  const [locationLabel, setLocationLabel] = useState("");
  const [inputType, setInputType] = useState<"place" | "coords">("place");
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
    
    if (inputType === "place" && finalLocationLabel) {
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(finalLocationLabel)}`);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            finalLat = parseFloat(geoData[0].lat);
            finalLng = parseFloat(geoData[0].lon);
          } else {
             setError(`We couldn't find "${finalLocationLabel}" on the map. Please try a more general area name or choose "Provide Coordinates Instead".`);
             setPending(false);
             return;
          }
        }
      } catch (err) {
        console.error("Geocoding failed", err);
        setError("Map service is currently unavailable. Please provide coordinates instead.");
        setPending(false);
        return;
      }
    }

    const res = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        category,
        locationLabel: finalLocationLabel,
        latitude:  finalLat,
        longitude: finalLng,
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
        <label>
          <span className="label-caps mb-1.5 block">Filing NGO</span>
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
        </label>

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
                      : "border-white/10 bg-surface-container/50 text-on-surface-variant hover:text-on-surface"
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
                  className="text-[11px] font-semibold uppercase text-emerald-400 hover:text-emerald-300"
                >
                  📍 Use Current Location
                </button>
                <div className="h-3 w-px bg-white/20"></div>
                <button
                  type="button"
                  className="text-[11px] font-semibold uppercase text-primary hover:text-primary-container"
                  onClick={() => setInputType("coords")}
                >
                  Provide Coordinates Instead
                </button>
              </div>
            </div>
            <input
              value={locationLabel}
              onChange={e => setLocationLabel(e.target.value)}
              placeholder="e.g. MG Road, Bangalore"
              className="input-field mb-3"
            />
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
                  className="text-[11px] font-semibold uppercase text-emerald-400 hover:text-emerald-300"
                >
                  📍 Use Current Location
                </button>
                <div className="h-3 w-px bg-white/20"></div>
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
          <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-white/5 pt-5">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Filing…" : "File Incident"}
            <span>↗</span>
          </button>
        </div>
      </div>
    </form>
  );
}
