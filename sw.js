const CACHE = 'webcam-v2';
const STATIC = new Set([
  '/', '/index.html', '/manifest.json', '/apple-icon.png', '/icon-192.png', '/icon-512.png', '/icon.svg',
  '/assets/app.js', '/assets/style.css', '/assets/model-worker.js', '/assets/manifold.wasm'
]);
const cacheable = (request, response) => {
  if (!response || response.status !== 200 || response.type !== 'basic' || response.redirected) return false;
  if (request.headers.has('authorization')) return false;
  const control = response.headers.get('cache-control') || '';
  const vary = response.headers.get('vary') || '';
  return !/no-store|private/i.test(control) && !/cookie|authorization/i.test(vary);
};
const save = async (request, response) => {
  if (!cacheable(request, response)) return;
  try {
    await (await caches.open(CACHE)).put(request, response.clone());
  } catch {}
};
self.addEventListener('install', event => {
  event.waitUntil(Promise.all([...STATIC].filter(path => path !== '/index.html').map(async path => {
    try {
      const request = new Request(path, { cache: 'reload', credentials: 'omit' });
      await save(request, await fetch(request));
    } catch {}
  })).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('webcam-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !STATIC.has(url.pathname) || request.headers.has('authorization')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        await save(request, response);
        return response;
      } catch (error) {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request) || await cache.match('/') || await cache.match('/index.html');
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      await save(request, response);
      return response;
    } catch (error) {
      const cached = await (await caches.open(CACHE)).match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
