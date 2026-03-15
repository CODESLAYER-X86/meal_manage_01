const CACHE_NAME = "messmate-v2";
const API_CACHE = "messmate-api-v1";
const OFFLINE_PAGE = "/offline.html";

// Static assets to pre-cache
const STATIC_ASSETS = [
  "/dashboard",
  "/calendar",
  "/billing",
  "/offline.html",
];

// API caching strategies
const API_CACHE_RULES = {
  "/api/mess": { maxAge: 24 * 60 * 60 * 1000, strategy: "cache-first" },       // 24h
  "/api/meals": { maxAge: 60 * 60 * 1000, strategy: "stale-while-revalidate" }, // 1h
  "/api/deposits": { maxAge: 60 * 60 * 1000, strategy: "stale-while-revalidate" },
  "/api/bazar": { maxAge: 60 * 60 * 1000, strategy: "stale-while-revalidate" },
  "/api/billing": { maxAge: 60 * 60 * 1000, strategy: "stale-while-revalidate" },
  "/api/bill-payments": { maxAge: 60 * 60 * 1000, strategy: "stale-while-revalidate" },
  "/api/bill-settings": { maxAge: 60 * 60 * 1000, strategy: "stale-while-revalidate" },
  "/api/transparency": { maxAge: 60 * 1000, strategy: "stale-while-revalidate" },
  "/api/meal-status": { maxAge: 5 * 60 * 1000, strategy: "network-first" },    // 5min
  "/api/notifications": { maxAge: 5 * 60 * 1000, strategy: "network-first" },
  "/api/fines": { maxAge: 30 * 60 * 1000, strategy: "stale-while-revalidate" },
  "/api/washroom": { maxAge: 60 * 60 * 1000, strategy: "stale-while-revalidate" },
  "/api/announcements": { maxAge: 30 * 60 * 1000, strategy: "stale-while-revalidate" },
};

// Install: pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Helper: find matching API cache rule
function getApiRule(url) {
  const path = new URL(url).pathname;
  for (const [pattern, rule] of Object.entries(API_CACHE_RULES)) {
    if (path.startsWith(pattern)) return rule;
  }
  return null;
}

// Helper: check if cached response is still fresh
function isFresh(response, maxAge) {
  const cached = response.headers.get("sw-cached-at");
  if (!cached) return false;
  return Date.now() - Number(cached) < maxAge;
}

// Helper: clone response with cache timestamp
function stampResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("sw-cached-at", String(Date.now()));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // --- API requests: apply caching strategies ---
  if (url.pathname.startsWith("/api/")) {
    const rule = getApiRule(request.url);
    if (!rule) return; // No cache rule = pass through

    if (rule.strategy === "cache-first") {
      event.respondWith(
        caches.open(API_CACHE).then((cache) =>
          cache.match(request).then((cached) => {
            if (cached && isFresh(cached, rule.maxAge)) return cached;
            return fetch(request)
              .then((response) => {
                if (response.ok) {
                  cache.put(request, stampResponse(response.clone()));
                }
                return response;
              })
              .catch(() => cached || new Response('{"error":"Offline"}', {
                status: 503,
                headers: { "Content-Type": "application/json" },
              }));
          })
        )
      );
      return;
    }

    if (rule.strategy === "network-first") {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(API_CACHE).then((cache) => cache.put(request, stampResponse(clone)));
            }
            return response;
          })
          .catch(() =>
            caches.open(API_CACHE).then((cache) =>
              cache.match(request).then((cached) =>
                cached || new Response('{"error":"Offline","offline":true}', {
                  status: 503,
                  headers: { "Content-Type": "application/json" },
                })
              )
            )
          )
      );
      return;
    }

    if (rule.strategy === "stale-while-revalidate") {
      event.respondWith(
        caches.open(API_CACHE).then((cache) =>
          cache.match(request).then((cached) => {
            const fetchPromise = fetch(request)
              .then((response) => {
                if (response.ok) {
                  cache.put(request, stampResponse(response.clone()));
                }
                return response;
              })
              .catch(() => null);

            // Return cached immediately, update in background
            if (cached && isFresh(cached, rule.maxAge)) {
              fetchPromise; // fire-and-forget update
              return cached;
            }
            // No fresh cache: wait for network, fall back to stale cache
            return fetchPromise.then((response) => response || cached || new Response('{"error":"Offline","offline":true}', {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }));
          })
        )
      );
      return;
    }
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

  // --- Static assets (JS, CSS, images): cache-first ---
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
  if (event.data === "CLEAR_API_CACHE") {
    caches.delete(API_CACHE);
  }
});
