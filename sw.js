const CACHE = 'gestao-coco-bambu-v98-cache-sync-firebase';
const APP_SHELL = [
  './manifest.json',
  './icon.png',
  './index.html',
  './eventos.html',
  './eventos.css',
  './eventos.js',
  './eventos-firebase.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  if (
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html')
  ) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(response => response)
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then(response => response)
      .catch(() => caches.match(req))
  );
});
