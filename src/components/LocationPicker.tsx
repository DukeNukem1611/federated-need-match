"use client";
// Click-to-place / drag-to-adjust location picker on a real Google Map.
// Clicking the map (or dragging the pin) reports exact coordinates back to the
// caller — the most precise way to set a spot that has no clean address.
import { useMemo } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  type MapMouseEvent,
} from "@vis.gl/react-google-maps";

export function LocationPicker({
  apiKey,
  value,
  onChange,
  fallbackCenter = { lat: 12.9716, lng: 77.5946 },
}: {
  apiKey: string;
  value: { lat: number; lng: number } | null;
  // Fired with exact coordinates whenever the user clicks the map or drags the pin.
  onChange: (lat: number, lng: number) => void;
  fallbackCenter?: { lat: number; lng: number };
}) {
  const center = useMemo(
    () => value ?? fallbackCenter,
    [value, fallbackCenter],
  );

  return (
    <div className="overflow-hidden rounded-md border border-black/10">
      <div className="h-[300px] w-full">
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={center}
            defaultZoom={value ? 15 : 11}
            mapId="DEMO_MAP_ID"
            colorScheme="LIGHT"
            gestureHandling="greedy"
            disableDefaultUI={false}
            clickableIcons={false}
            onClick={(e: MapMouseEvent) => {
              const ll = e.detail.latLng;
              if (ll) onChange(ll.lat, ll.lng);
            }}
            style={{ width: "100%", height: "100%" }}
          >
            {value && (
              <AdvancedMarker
                position={value}
                draggable
                onDragEnd={e => {
                  const ll = e.latLng;
                  if (ll) onChange(ll.lat(), ll.lng());
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 9999,
                    background: "#0891b2",
                    border: "3px solid #fff",
                    boxShadow: "0 1px 4px rgba(15,33,46,0.3), 0 0 0 8px rgba(8,145,178,0.16)",
                    cursor: "grab",
                  }}
                />
              </AdvancedMarker>
            )}
          </Map>
        </APIProvider>
      </div>
      <p className="border-t border-black/5 bg-surface-container-low/60 px-3 py-2 text-[11px] text-on-surface-variant">
        {value
          ? "Click again or drag the pin to fine-tune."
          : "Click anywhere on the map to drop a pin."}
      </p>
    </div>
  );
}
