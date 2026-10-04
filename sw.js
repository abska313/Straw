/* ============================================================
   HAYSTACK — Service Worker (v3 · Single-File Build)
   ============================================================ */

const CACHE_NAME = 'haystack-v3';
const CACHE_PREFIX = 'haystack-';

/* الملفات الأساسية التي يجب تخزينها عند التثبيت */
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

/* ملفات CDN الخارجية (Three.js) — نخزنها عند أول استخدام */
const EXTERNAL_HOSTS = [
  'unpkg.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com'
];

/* ============================================================
   INSTALL — تخزين الملفات الأساسية
   ============================================================ */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // نستخدم individual put لتفادي فشل addAll عند نقص ملف واحد
        return Promise.all(
          CORE_ASSETS.map(url =>
            cache.add(url).catch(err =>
              console.warn('[SW] Failed to cache:', url, err)
            )
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

/* ============================================================
   ACTIVATE — حذف الكاشات القديمة
   ============================================================ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
            .map(k => {
              console.log('[SW] Deleting old cache:', k);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ============================================================
   FETCH — استراتيجية ذكية حسب نوع الطلب
   ============================================================ */
self.addEventListener('fetch', event => {
  const req = event.request;

  // نتجاهل ما ليس GET
  if (req.method !== 'GET') return;

  // نتجاهل chrome-extension وغيرها
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;

  const isSameOrigin = url.origin === self.location.origin;
  const isExternal = EXTERNAL_HOSTS.some(h => url.hostname.includes(h));

  /* ---------- 1) الطلبات الخارجية (Three.js من unpkg) ---------- */
  if (isExternal) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  /* ---------- 2) نفس الأصل ---------- */
  if (isSameOrigin) {
    // صفحات HTML → Network-first (لكي يحصل المستخدم على آخر تحديث)
    if (req.mode === 'navigate' || req.destination === 'document') {
      event.respondWith(networkFirst(req, './index.html'));
      return;
    }
    // باقي الملفات (أيقونات، manifest) → Cache-first
    event.respondWith(cacheFirst(req));
    return;
  }

  // أي شيء آخر → نمرّره للشبكة
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

/* ============================================================
   STRATEGIES
   ============================================================ */

/** Cache-first: مثالي للأيقونات و manifest */
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    // Fallback للصفحة الرئيسية إذا كان طلب تنقّل
    if (req.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw err;
  }
}

/** Network-first: للصفحات — يحاول الشبكة أولاً ثم الكاش */
async function networkFirst(req, fallbackUrl) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    const fallback = await caches.match(fallbackUrl);
    if (fallback) return fallback;
    throw err;
  }
}

/** Stale-while-revalidate: للـ CDN — يخدم من الكاش فورًا ويحدّث بالخلفية */
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  const fetchPromise = fetch(req)
    .then(res => {
      if (res && res.status === 200) {
        cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => cached); // إذا فشلت الشبكة، نرجع الكاش

  return cached || fetchPromise;
}

/* ============================================================
   MESSAGES — للتحكم من الصفحة الرئيسية
   ============================================================ */
self.addEventListener('message', event => {
  const data = event.data;

  // تخطي الانتظار لتطبيق تحديث فوري
  if (data === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // مسح كل الكاش (Reset)
  if (data === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ ok: true });
          }
        })
    );
  }

  // الحصول على اسم الكاش الحالي
  if (data === 'GET_CACHE_NAME') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ name: CACHE_NAME });
    }
  }
});

/* ============================================================
   NOTIFICATIONS — إشعار عند التحديث (اختياري)
   ============================================================ */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow('./');
    })
  );
});

console.log('[SW] HAYSTACK Service Worker loaded · Cache:', CACHE_NAME);
