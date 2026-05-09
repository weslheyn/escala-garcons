const CACHE = 'gestao-coco-bambu-v98-cache-sync-firebase';
const APP_SHELL = ['./manifest.json', './icon.png'];

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
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_OLD_CACHES') {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))));
  }
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // Nunca servir HTML/JS/CSS/JSON antigos do cache. Isso evita dashboard divergente entre dispositivos.
  const isAppFile = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html') ||
    ['script', 'style'].includes(req.destination) ||
    /\.(html|js|css|json)$/i.test(url.pathname);

  if (isAppFile) {
    event.respondWith(fetch(new Request(req, { cache: 'no-store' })).catch(() => caches.match(req)));
    return;
  }

  // Imagens/ícones podem usar cache como fallback.
  event.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req))
  );
});
