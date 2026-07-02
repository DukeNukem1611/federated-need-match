"use client";
// Polling notification bell. Fetches the given user's feed every `intervalMs`,
// shows an unread-count badge, and a dropdown of recent notifications.
// Clicking a notification with an incident routes to that incident; the
// "Mark all read" action clears the badge.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  incident: { id: string; title: string; category: string } | null;
};

export function NotificationBell({
  userId,
  intervalMs = 10_000,
}: {
  userId: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?userId=${userId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      /* network blip — keep last known state */
    }
  }, [userId]);

  // Poll while mounted. Initial load is also driven here so server/client
  // markup stays identical (badge starts hidden, populated after mount).
  useEffect(() => {
    load();
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAllRead() {
    setUnread(0);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    load();
  }

  function openNotif(n: Notif) {
    // Optimistically mark read + persist in the background so navigation is
    // never blocked on the network round-trip.
    if (!n.read) {
      setNotifs(prev => prev.map(x => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread(u => Math.max(0, u - 1));
      fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, id: n.id }),
      }).catch(() => {});
    }
    if (n.incident) {
      setOpen(false);
      router.push(`/incidents/${n.incident.id}`);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-black/10 bg-surface-container-high/60 text-on-surface-variant transition-colors hover:border-primary-container/50 hover:text-primary-container"
        aria-label="Notifications"
      >
        <span className="text-base">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-surface">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-black/10 bg-surface-container-high/95 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
            <p className="label-caps text-surface-tint">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-semibold uppercase tracking-wide text-primary hover:text-primary-container"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifs.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-on-surface-variant">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-black/5">
                {notifs.map(n => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openNotif(n)}
                      className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-black/5 ${
                        n.read ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && (
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-container" />
                        )}
                        <span className={`text-sm font-medium ${n.read ? "text-on-surface-variant" : "text-on-surface"}`}>
                          {n.title}
                        </span>
                      </div>
                      <span className="pl-3.5 text-xs text-on-surface-variant">{n.body}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
