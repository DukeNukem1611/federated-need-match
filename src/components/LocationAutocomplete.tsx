"use client";
// Location typeahead. As the user types, it queries /api/geocode (the shared
// server geocoder) and shows matching places. Picking one yields exact
// coordinates — that's the precise path. Typing free-text without picking is
// still fine: the caller falls back to server geocoding on submit.
import { useEffect, useRef, useState } from "react";

type GeoResult = { lat: number; lng: number; matchedLabel: string };

export function LocationAutocomplete({
  value,
  onChange,
  onPick,
  placeholder,
  className,
}: {
  value: string;
  // Free typing — the caller should treat any prior exact pick as stale.
  onChange: (label: string) => void;
  // User selected a concrete match → exact coordinates.
  onPick: (result: GeoResult) => void;
  placeholder?: string;
  className?: string;
}) {
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  // Skip the lookup that would otherwise fire right after a pick sets the value.
  const skipNextFetch = useRef(false);

  // Debounced suggestion fetch.
  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setResults(Array.isArray(data.results) ? data.results : []);
        setOpen(true);
        setHighlight(-1);
      } catch {
        /* aborted or offline — leave prior results */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(r: GeoResult) {
    skipNextFetch.current = true;
    onPick(r);
    setOpen(false);
    setResults([]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pick(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-on-surface-variant">
          …
        </span>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-black/10 bg-surface-container-low shadow-xl backdrop-blur-md">
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <button
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(r)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition-colors ${
                  i === highlight
                    ? "bg-primary-container/15 text-on-surface"
                    : "text-on-surface-variant hover:bg-black/5"
                }`}
              >
                <span className="mt-0.5 text-primary-container">◎</span>
                <span className="leading-snug">{r.matchedLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
