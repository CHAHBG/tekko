const CACHE_NAME = 'tapal-v1';
const PRECACHE_URLS = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only handle http/https — skip chrome-extension, data, etc.
  if (!url.protocol.startsWith('http')) return;

  // Skip Vite HMR / dev-server internals
  if (url.pathname.startsWith('/@') || url.pathname.includes('@vite') || url.pathname.includes('@react-refresh')) return;

  // Network-first for API and dynamic card routes
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/c/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache valid same-origin or CORS responses
        if (response && response.ok && (response.type === 'basic' || response.type === 'cors')) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || Response.error()))
  );
});
