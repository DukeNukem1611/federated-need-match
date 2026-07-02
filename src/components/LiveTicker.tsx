// A continuously scrolling activity ticker (CSS marquee — no JS). The track is
// rendered twice so the loop is seamless; it pauses on hover. Server component.
import Link from "next/link";

export type TickerItem = { id: string; icon: string; text: string; href?: string };

export function LiveTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;
  const track = [...items, ...items];

  return (
    <div className="relative z-10 border-b border-black/5 bg-surface-container/40 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-6 sm:px-10">
        <span className="flex shrink-0 items-center gap-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-emerald-500" />
          Live
        </span>

        <div className="relative flex-1 overflow-hidden">
          <div className="flex w-max gap-8 whitespace-nowrap py-2.5 animate-marquee hover:[animation-play-state:paused]">
            {track.map((it, i) => {
              const body = (
                <span className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <span>{it.icon}</span>
                  <span className="transition-colors hover:text-primary">{it.text}</span>
                  <span className="text-primary-container/40">•</span>
                </span>
              );
              return it.href ? (
                <Link key={i} href={it.href} className="shrink-0">
                  {body}
                </Link>
              ) : (
                <span key={i} className="shrink-0">
                  {body}
                </span>
              );
            })}
          </div>
          {/* Edge fades so items appear/disappear softly. */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-surface to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface to-transparent" />
        </div>
      </div>
    </div>
  );
}
