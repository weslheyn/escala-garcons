const CACHE='coco-bambu-v1';
self.addEventListener('install',e=>e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(['./','/escala-garcons/','/escala-garcons/index.html','/escala-garcons/manifest.json']))
));
self.addEventListener('fetch',e=>e.respondWith(
  fetch(e.request).catch(()=>caches.match(e.request))
));
