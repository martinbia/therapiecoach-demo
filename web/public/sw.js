/* Static demo shell only. NEVER cache Worker/API traffic or responses. */
const CACHE = 'anna-pwa-shell-v1';
const SCOPE = new URL(self.registration.scope);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(SCOPE.href)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('anna-pwa-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  // Videos use range requests; leave playback to the browser network/disk cache.
  if (req.headers.has('range') || /\.(mp4|webm)$/i.test(url.pathname)) return;
  event.respondWith(fetch(req).then(response => {
    if (response.ok && response.type === 'basic' && !/\/api\//.test(url.pathname)) {
      const cloned = response.clone();
      void caches.open(CACHE).then(cache => cache.put(req, cloned));
    }
    return response;
  }).catch(async () => (await caches.match(req)) || (req.mode === 'navigate' ? caches.match(SCOPE.href) : Response.error())));
});
