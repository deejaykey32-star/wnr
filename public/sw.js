const CACHE_NAME = 'embik365-v102-fresh-build';

// Only truly static files go here — NO JS chunks (they change on every build)
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png'
];

// Install: pre-cache only static icons/manifest, skip waiting immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => Promise.resolve());
    })
  );
});

// Activate: purge ALL old caches immediately and claim all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          console.log('[SW] Deleting cache:', cache);
          return caches.delete(cache);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event strategy:
// - Navigation (HTML pages): network-first, fallback to / for SPA
// - /assets/*.js and /assets/*.css: ALWAYS network, NEVER serve from cache
// - /data/*: ALWAYS network, NEVER serve from cache (ensures cross-device sync gets latest db_snapshot)
// - Static icons/manifest: cache-first (they rarely change)
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  const url = new URL(event.request.url);

  // SPA Navigation — network-first with / fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            return networkResponse;
          }
          return caches.match('/').then((cached) => cached || networkResponse);
        })
        .catch(() => {
          return caches.match('/').then((cached) => {
            return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
          });
        })
    );
    return;
  }

  // JS/JSON/WASM chunks under /assets/ and data snapshots under /data/: ALWAYS go to network, never cache
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/data/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((cached) => cached || new Response('Asset unavailable offline', { status: 503 }));
      })
    );
    return;
  }

  // Static icons, manifest etc: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

