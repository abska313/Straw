const CACHE_NAME = 'haystack-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-400-normal.css',
  'https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-700-normal.css',
  'https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-900-normal.css',
  'https://ga.jspm.io/npm:es-module-shims@1.8.3/dist/es-module-shims.js',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => {
      return res || fetch(e.request).catch(() => caches.match('./index.html'));
    })
  );
});
