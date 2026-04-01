const CACHE='coco-bambu-v2';
self.addEventListener('install',e=>e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(['./','/','index.html','manifest.json']))
));
self.addEventListener('fetch',e=>e.respondWith(
  fetch(e.request).catch(()=>caches.match(e.request))
));
