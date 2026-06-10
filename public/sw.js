const CACHE_NAME = 'unicrop-erp-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
        ),
    );
    self.clients.claim();
});

// Cache-first for hashed build assets and static files (safe to cache forever).
// Network-first for everything else (pages, API, Inertia data) so the ERP
// always shows fresh data when online, falling back to cache when offline.
self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    const isStaticAsset = url.pathname.startsWith('/build/') || /\.(?:js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname);

    if (isStaticAsset) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) =>
                cache.match(request).then(
                    (cached) =>
                        cached ||
                        fetch(request).then((response) => {
                            if (response.ok) cache.put(request, response.clone());
                            return response;
                        }),
                ),
            ),
        );
        return;
    }

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
                }
                return response;
            })
            .catch(() => caches.match(request)),
    );
});
