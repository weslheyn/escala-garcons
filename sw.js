const CACHE_VERSION = 'gestao-coco-bambu-v106-pracas-eventos-stable';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      try {
        client.postMessage({ type: 'APP_CACHE_CLEARED', version: CACHE_VERSION });
      } catch (e) {}
    }
  })());
});

self.addEventListener('fetch', event => {
  // Sempre tenta rede primeiro e não guarda HTML/JS/CSS em cache.
  event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request)));
});
