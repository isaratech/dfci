// Cache the app shell only; OSM tiles stay on the network
// (OSM usage policy + browser HTTP cache).
const CACHE = 'dfci-v7';
const ASSETS = [
  '.',
  'index.html',
  'app.js',
  'dfci.js',
  'manifest.webmanifest',
  'icon.svg',
  'vendor/leaflet.js',
  'vendor/leaflet.css',
  'vendor/proj4.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  // ignoreSearch: shared links (?c=CODE) must serve the app shell offline
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
