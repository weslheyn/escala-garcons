const CACHE = 'v99-force-clean-all';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));

    await self.clients.claim();

    const clients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    clients.forEach(client => {
      const url = new URL(client.url);
      url.searchParams.set('cacheBust', Date.now().toString());
      client.navigate(url.toString());
    });
  })());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
  );
});