// HAYSTACK — Service Worker
const CACHE_NAME = 'haystack-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './css/style.css',
  './js/main.js',
  './js/core/Game.js',
  './js/core/Input.js',
  './js/core/EventBus.js',
  './js/player/Player.js',
  './js/world/World.js',
  './js/hay/HayPile.js',
  './js/items/ItemsDB.js',
  './js/inventory/Inventory.js',
  './js/tools/ToolSystem.js',
  './js/save/SaveSystem.js',
  './js/ui/UI.js',
  './js/skills/SkillTree.js',
  './js/statistics/Statistics.js',
  './js/achievements/Achievements.js',
  './js/missions/Missions.js',
  './js/areas/Areas.js',
  './js/audio/AudioSystem.js',
  './js/machines/Machines.js',
  './js/storage/Storage.js'
];

// ---------- INSTALL ----------
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS).catch(err => {
        console.warn('[SW] Some core assets failed to cache:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// ---------- ACTIVATE ----------
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ---------- FETCH ----------
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // CDN / external assets (three.js from unpkg) — stale-while-revalidate
  if (!isSameOrigin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const network = fetch(event.request).then(res => {
            if (res && res.status === 200) {
              cache.put(event.request, res.clone());
            }
            return res;
          }).catch(() => cached);
          return cached || network;
        })
      )
    );
    return;
  }

  // Same-origin — cache-first, with navigation fallback to index.html
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// ---------- MESSAGES ----------
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
