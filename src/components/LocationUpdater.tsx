"use client";
// One-tap "use my location" for volunteers. Matching is distance-weighted, so
// coordinates should reflect where the volunteer actually is — not whatever
// the admin typed when creating them. PATCHes the existing self-update API.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LocationUpdater({
  userId,
  latitude,
  longitude,
}: {
  userId: string;
  latitude: number | null;
  longitude: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  function update() {
    setError(null);
    setSavedLabel(null);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const res = await fetch(`/api/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude: lat, longitude: lng }),
        });
        if (!res.ok) {
          setError("Couldn't save your location — try again.");
          setBusy(false);
          return;
        }
        // Friendly confirmation: resolve the place name (best-effort).
        try {
          const geo = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`).then(r => r.json());
          setSavedLabel(geo?.label ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } catch {
          setSavedLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
        setBusy(false);
        router.refresh();
      },
      err => {
        setBusy(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — allow it in your browser settings."
            : "Couldn't get your location. Try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        onClick={update}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
        title="Update your position so matches reflect where you actually are"
      >
        {busy ? "Locating…" : "📍 Use my location"}
      </button>
      {savedLabel ? (
        <span className="text-emerald-700">✓ Location updated — {savedLabel}</span>
      ) : latitude != null && longitude != null ? (
        <span className="mono-data text-[10px] uppercase tracking-wider text-on-surface-variant">
          current: {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </span>
      ) : (
        <span className="text-on-surface-variant">no location on record — matches may rank you lower</span>
      )}
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
