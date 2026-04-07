const CACHE_NAME = "messmate-v3";
const OFFLINE_PAGE = "/offline.html";

// Static assets to pre-cache
const STATIC_ASSETS = [
  "/offline.html",
];

// Install: pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: DELETE all old caches (including stale API caches)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // NEVER cache API requests — always go to network
  // API data changes frequently (kicks, joins, meal toggles, etc.)
  // Caching caused stale mess data to persist for up to 24 hours
  if (url.pathname.startsWith("/api/")) {
    return; // Let the browser handle it normally (no interception)
  }

  // --- Page requests: network-first with offline fallback ---
  if (request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || caches.match(OFFLINE_PAGE)
          )
        )
    );
    return;
  }

  // --- Static assets (JS, CSS, images, fonts): cache-first ---
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response("", { status: 503 }));
      })
    );
    return;
  }
});

// Listen for messages from the app
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// --- Push Notifications ---
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "MessMate";
    const options = {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: {
        url: data.url || "/dashboard",
      },
      vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    // Fallback if data is not JSON
    event.waitUntil(
      self.registration.showNotification("MessMate", {
        body: event.data.text(),
        icon: "/icons/icon-192.png",
      })
    );
  }
});

// --- Notification Click ---
self.addEventListener("notificationclick", (event) => {
  event.notification.close(); // Close the notification

  const urlToOpen = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // If so, just focus it.
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

