const CACHE_NAME = 'guardians-ocean-v4';
const ASSETS = [
  './',
  './index.html',
  './save-the-earth (4).html',
  './css/goo.css',
  './js/goo-core.js',
  './js/goo-compass.js',
  './js/goo-shell.js',
  './js/goo-globe.js',
  './js/goo-cards.js',
  './js/goo-map.js',
  './js/pwa-app.js',
  './manifest.webmanifest',
  './photos/card-jungle.jpg',
  './photos/card-thirsty.jpg',
  './photos/city-jakarta.jpg',
  './photos/city-manila.jpg',
  './photos/city-hcmc.jpg',
  './photos/city-lagos.jpg',
  './photos/city-miami.jpg',
  './photos/city-mumbai.jpg',
  './photos/city-mombasa.jpg',
  './photos/city-sydney.jpg',
  './photos/city-capetown.jpg',
  './photos/city-rotterdam.jpg',
  './pwa/island-weather-pwa/index.html',
  './pwa/island-weather-pwa/background.jpg',
  './pwa/island-weather-pwa/icons/icon-192.png',
  './pwa/island-weather-pwa/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }
  if (url.includes('open-meteo.com') || url.includes('nominatim.openstreetmap.org') || url.includes('arcgisonline.com')) {
    event.respondWith(
      fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((res) => {
        if (res && res.ok && event.request.method === 'GET' && url.indexOf(self.location.origin) === 0) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
