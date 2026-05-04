const CACHE='gestao-coco-bambu-v50-eventos-premium';
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./manifest.json','./icon.png']).catch(()=>{})));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE?caches.delete(k):null))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req=e.request;
  if(req.method!=='GET') return;
  if(req.mode==='navigate' || (req.headers.get('accept')||'').includes('text/html')){
    e.respondWith(fetch(req).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(fetch(req).then(r=>{ const clone=r.clone(); caches.open(CACHE).then(c=>c.put(req,clone)).catch(()=>{}); return r; }).catch(()=>caches.match(req)));
});
