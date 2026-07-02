"use client";
// Full-width live notification list for the user page. Polls the same API as
// NotificationBell but renders an inline feed instead of a dropdown.
import { useCallback, useEffect, useState } from "react";
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

export function NotificationFeed({
  userId,
  intervalMs = 10_000,
}: {
  userId: string;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?userId=${userId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setNotifs(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch {
      /* ignore transient errors */
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    load();
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

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
    if (n.incident) router.push(`/incidents/${n.incident.id}`);
  }

  return (
    <div className="glass-panel rounded-xl">
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-primary-container" />
          <p className="label-caps text-surface-tint">Notifications</p>
          {unread > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {unread} new
            </span>
          )}
        </div>
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

      {!loaded ? (
        <p className="px-5 py-10 text-center text-sm text-on-surface-variant">Loading…</p>
      ) : notifs.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-on-surface-variant">
          No notifications yet. You&rsquo;ll be alerted here when a new incident is filed.
        </p>
      ) : (
        <ul className="divide-y divide-black/5">
          {notifs.map(n => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => openNotif(n)}
                className={`flex w-full flex-col gap-1 px-5 py-4 text-left transition-colors hover:bg-black/5 ${
                  n.read ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      n.read ? "bg-black/15" : "bg-primary-container animate-pulse-dot"
                    }`}
                  />
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${n.read ? "text-on-surface-variant" : "text-on-surface"}`}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">{n.body}</p>
                  </div>
                  {n.incident && (
                    <span className="mt-0.5 shrink-0 text-primary-container">→</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
