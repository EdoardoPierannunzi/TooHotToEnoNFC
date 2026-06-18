// ============================================================
//  Service Worker — NFC Card Manager (Public)
//  Cacha solo gli asset statici (HTML/CSS/font). Le chiamate
//  verso l'API Apps Script passano sempre dalla rete: il saldo
//  deve essere sempre quello vero, mai una versione vecchia in cache.
// ============================================================

const CACHE_NAME = 'nfc-public-v2';
const STATIC_ASSETS = [
  './public.html',
  './manifest-public.json',
  './icons/public-192.png',
  './icons/public-512.png',
  './icons/public-maskable-512.png'
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

  // Mai cachare chiamate verso Apps Script (script.google.com) o
  // qualsiasi richiesta con parametro ?api= — devono sempre essere "fresche".
  if (
    url.hostname.includes('script.google.com') ||
    url.searchParams.has('api')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Per la pagina HTML principale: network-first, con la cache solo come
  // fallback offline. Senza questo, una volta cachata una versione di
  // public.html, il Service Worker continuerebbe a servirla per sempre
  // anche dopo un aggiornamento del file sul server.
  const isHtmlPage = event.request.mode === 'navigate' || url.pathname.endsWith('.html');
  if (isHtmlPage) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Per gli altri asset statici: cache-first con fallback di rete,
  // così l'app si apre istantaneamente anche con connessione lenta.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cacha anche font/CDN esterni incontrati durante l'uso
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
