// ============================================================
//  Service Worker — NFC Card Manager (Admin)
//  Cacha solo gli asset statici. Le chiamate API verso Apps
//  Script passano sempre dalla rete (saldo/carte sempre aggiornati).
// ============================================================

const CACHE_NAME = 'nfc-admin-v1';
const STATIC_ASSETS = [
  './index.html',
  './manifest-admin.json',
  './icons/admin-192.png',
  './icons/admin-512.png',
  './icons/admin-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Mai cachare le chiamate verso Apps Script: i dati delle carte
  // e i saldi devono sempre arrivare freschi dalla rete.
  if (
    url.hostname.includes('script.google.com') ||
    url.searchParams.has('api')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
