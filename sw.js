const CACHE_VERSION = 'gestao-coco-bambu-pwa-alarmes-v5-1';
const STATIC_ASSETS = [
  './manifest.json',
  './icon.png',
  './gerenciador-tarefas-v3.html',
  './gerenciador-tarefas-v3.css',
  './gerenciador-tarefas-v3.js',
  './gerenciador-tarefas-firebase.js',
  './assets/sounds/trumpet-military-wake-up.mp3',
  './assets/sounds/iphone-assobio-guitarra.mp3',
  './assets/sounds/sinos-cancao-passaros.mp3',
  './assets/sounds/dance-monkey-iphone-remix.mp3',
  './assets/sounds/jk-sax-dance-monkey.mp3',
  './assets/sounds/dance-monkey-piano-violino.mp3'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(STATIC_ASSETS).catch(() => undefined)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      try { client.postMessage({ type: 'APP_CACHE_READY', version: CACHE_VERSION }); } catch (e) {}
    }
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin !== location.origin) return;
  if (req.destination === 'document' || url.pathname.endsWith('.html') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
    return;
  }
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE_VERSION).then(cache => cache.put(req, copy)).catch(() => undefined);
    return res;
  }).catch(() => cached)));
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'SHOW_TASK_ALARM') {
    const n = data.notification || {};
    self.registration.showNotification(n.title || 'Gerenciador de Tarefas', n.options || {});
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = new URL(data.url || './gerenciador-tarefas-v3.html', self.location.href).href;
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client && client.url.includes('gerenciador-tarefas-v3.html')) {
        try { client.postMessage({ type: 'OPEN_TASK_FROM_NOTIFICATION', data }); } catch (e) {}
        return client.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});
