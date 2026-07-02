// Service worker for the Federated Relief PWA. Handles Web Push (notification
// display + click) AND the minimal offline behaviour that makes the app
// installable: it pre-caches an offline fallback page and serves it when a
// navigation fails because the device is offline. Kept dependency-free.

const CACHE = "relief-shell-v1";
const OFFLINE_URL = "/offline.html";

// Pre-cache the offline fallback and activate immediately.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"])),
  );
  self.skipWaiting();
});

// Take control of open pages and drop stale caches.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first for page navigations only. If the network is unavailable we
// return the cached offline page. API calls, POSTs, and everything else pass
// straight through untouched so auth and live data are never cached/stale.
self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL)),
  );
});

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Federated Relief";
  const options = {
    body: data.body || "",
    data: { url: data.url || "/", matchId: data.matchId || null },
    tag: data.tag || undefined,
    renotify: false,
    // Action buttons (Android / desktop Chrome; ignored where unsupported).
    actions: Array.isArray(data.actions) ? data.actions : undefined,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

function openApp(url) {
  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    });
}

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || "/";

  // Accept / Decline tapped directly on an assignment notification: call the
  // API from here (cookies ride along on same-origin fetches). Confirm with a
  // follow-up notification either way.
  if ((event.action === "accept" || event.action === "decline") && data.matchId) {
    const verb = event.action;
    event.waitUntil(
      fetch(`/api/matches/${data.matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: verb }),
      })
        .then(res =>
          self.registration.showNotification(
            res.ok
              ? verb === "accept"
                ? "✔ Assignment accepted"
                : "Assignment declined"
              : "Couldn't update the assignment",
            {
              body: res.ok
                ? verb === "accept"
                  ? "You're marked as deployed — open the app for details."
                  : "The need was reopened for the next candidate."
                : "Open the app and respond from My Assignments (you may need to sign in).",
              data: { url: "/me" },
            },
          ),
        )
        .catch(() =>
          self.registration.showNotification("You're offline", {
            body: "Couldn't reach the server — open the app to respond.",
            data: { url: "/me" },
          }),
        ),
    );
    return;
  }

  event.waitUntil(openApp(url));
});
