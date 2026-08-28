/**
 * Service worker: an app shell cache and nothing clever.
 *
 * The only offline promise this app makes is that the shell loads and that a
 * captured thought is never lost — actual queuing of captures happens in the
 * page (see `useOfflineQueue`), where it can use IndexedDB-free localStorage and
 * stay debuggable. API responses are deliberately never cached: showing someone
 * a stale draft they then edit is worse than showing them an error.
 */

const CACHE = "writing-assistant-shell-v2";
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


/**
 * Reminders.
 *
 * The payload is JSON written by the server. A push that arrives with no body
 * still shows something rather than the browser's own "This site has been
 * updated in the background" placeholder, which is alarming and says nothing.
 */
self.addEventListener("push", event => {
  let payload = {
    title: "Time to write, if you'd like",
    body: "A few minutes is enough.",
    url: "/",
  };

  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Malformed payload: fall back to the default rather than showing nothing.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // One reminder at a time. A stack of identical nudges is nagging.
      tag: "writing-reminder",
      renotify: false,
      data: { url: payload.url },
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  // Focus an open tab if there is one rather than opening a duplicate.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(clients => {
        for (const client of clients) {
          if (client.url.includes(new URL(target, self.location.origin).pathname)) {
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      })
  );
});
