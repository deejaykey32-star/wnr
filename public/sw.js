const CACHE_NAME = 'embik365-v100-fresh-build';

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
//   (chunks have content-hash in filename so stale cache = wrong version crash)
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

  // JS/JSON/WASM chunks under /assets/: ALWAYS go to network, never cache
  // These have Vite content-hashes in filenames so stale cache = wrong version
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response('Asset unavailable offline', { status: 503 });
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

