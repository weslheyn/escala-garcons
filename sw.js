const CACHE='coco-bambu-oficial-v30-whatsapp-formato-exato';
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./manifest.json']).catch(()=>{})));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.mode === 'navigate' || (req.headers.get('accept')||'').includes('text/html')){
    e.respondWith(fetch(req).catch(()=>caches.match(req)));
    return;
  }
  e.respondWith(fetch(req).catch(()=>caches.match(req)));
});
