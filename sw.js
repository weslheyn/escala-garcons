<<<<<<< HEAD
const CACHE = 'gestao-coco-bambu-v98-cache-sync-firebase';

const APP_SHELL = [
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', event => {
=======
const CACHE='gestao-coco-bambu-v84-funil-drag-livre-definitivo';
self.addEventListener('install', e => {
>>>>>>> c2844d52d466849ce437b1706bbda4febee8fc91
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE)
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
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});