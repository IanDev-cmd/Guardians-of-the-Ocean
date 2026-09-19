const CACHE_NAME = 'guardians-ocean-v15';
const ASSETS = [
  './',
  './index.html',
  './save-the-earth (4).html',
  './success.html',
  './cart.html',
  './cancel.html',
  './css/goo.css',
  './js/goo-core.js',
  './js/boot.js',
  './js/goo-config.js',
  './js/goo-stripe.js',
  './js/goo-compass.js',
  './js/goo-shell.js',
  './js/goo-globe.js',
  './js/goo-cards.js',
  './js/goo-map.js',
  './js/pwa-app.js',
  './manifest.webmanifest',
  './assets/3d/earth-atmos.jpg',
  './assets/3d/earth-night.jpg',
  './assets/3d/earth-preview.webp',
  './assets/maps/cities.json',
  './assets/maps/schools.geojson',
  './assets/images/cards/jungle.webp',
  './assets/images/cards/thirsty.webp',
  './assets/images/cities/jakarta.webp',
  './assets/images/cities/manila.webp',
  './assets/images/cities/hcmc.webp',
  './assets/images/cities/lagos.webp',
  './assets/images/cities/miami.webp',
  './assets/images/cities/mumbai.webp',
  './assets/images/cities/mombasa.webp',
  './assets/images/cities/sydney.webp',
  './assets/images/cities/capetown.webp',
  './assets/images/cities/rotterdam.webp',
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

function networkFirst(request) {
  return fetch(request)
    .then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
      }
      return res;
    })
    .catch(() => caches.match(request));
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  const path = new URL(url).pathname;
  const live =
    url.includes('open-meteo.com') ||
    url.includes('nominatim.openstreetmap.org');
  const tiles = url.includes('arcgisonline.com') || url.includes('tile.openstreetmap.org');
  const appFile =
    event.request.mode === 'navigate' ||
    live ||
    /\.(html?|js|css|webmanifest|json)$/i.test(path) ||
    path.endsWith('/');

  if (appFile) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((res) => {
          if (res && res.ok && event.request.method === 'GET' && (url.indexOf(self.location.origin) === 0 || tiles)) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
