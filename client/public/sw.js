/**
 * Service worker: an app shell cache and nothing clever.
 *
 * The only offline promise this app makes is that the shell loads and that a
 * captured thought is never lost — actual queuing of captures happens in the
 * page (see `useOfflineQueue`), where it can use IndexedDB-free localStorage and
 * stay debuggable. API responses are deliberately never cached: showing someone
 * a stale draft they then edit is worse than showing them an error.
 */

const CACHE = "writing-assistant-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE)
      // `ignoreVary` keeps the navigation request matchable later.
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;

  // Never touch the API: writes must fail loudly rather than silently succeed.
  if (request.method !== "GET" || new URL(request.url).pathname.startsWith("/api/")) {
    return;
  }

  // Navigations: network first, falling back to the cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/").then(cached => cached ?? Response.error()))
    );
    return;
  }

  // Static assets: serve from cache, and refresh the entry in the background.
  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached ?? Response.error());

      return cached ?? network;
    })
  );
});
