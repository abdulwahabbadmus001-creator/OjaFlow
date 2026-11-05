const CACHE_NAME = 'ojaflow-pwa-v7';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/ojaflow-of.svg?v=2',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith('ojaflow-') && key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isCacheableStaticAsset(url) {
  if (url.pathname.startsWith('/api/')) return false;
  if (url.pathname.startsWith('/assets/')) return true;
  if (url.pathname.startsWith('/icons/')) return true;
  if (url.pathname.startsWith('/auth-market/')) return true;
  return /\.(?:js|css|woff2?|ttf|otf|png|svg|webp|jpg|jpeg|ico)$/i.test(
    url.pathname
  );
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API endpoints in the service worker
  if (url.pathname.startsWith('/api/')) return;

  // HTML navigation requests: Network-first falling back to cached app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('/', copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(res => res || caches.match('/'))
        )
    );
    return;
  }

  // Static JS/CSS/font/image assets: Stale-While-Revalidate for instant offline boot
  if (isCacheableStaticAsset(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const networkFetch = fetch(request)
            .then(response => {
              if (response && response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached);

          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // Default fallback
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
      .then(response => response || caches.match('/'))
  );
});
