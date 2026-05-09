const CACHE = 'gestao-coco-bambu-v102-pracas-sorteio-layout';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => {
      try {
        const url = new URL(client.url);
        if (!url.searchParams.get('v102')) url.searchParams.set('v102', Date.now().toString());
        client.navigate(url.toString());
      } catch (e) {}
    });
  })());
});

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request, { cache: 'no-store' }));
});
