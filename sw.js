// Service worker: network-first for everything (so deploys are picked up immediately),
// falling back to the last cached copy when offline. Makes the app installable and usable
// with no signal — the on-device OCR and all the math work offline.
const CACHE = 'mpt-v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'schools.js', 'plans.js', 'receipt.js', 'ocr.js', 'advisor.js', 'eat.js', 'tips.js', 'today.js', 'forecast.js', 'share.js', 'auth-config.js', 'account-store.js', 'auth.js', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {}))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin && !/cdnjs|jsdelivr/.test(url.host)) return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: url.origin === location.origin })));
});
