/* ================================================
   AZAR FINANCE — sw.js (Service Worker)
   Offline Support · Cache First Strategy
   ================================================ */

const CACHE_NAME = 'azar-finance-v1';
const CACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap',
];

// ===== INSTALL: Cache all assets =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app assets...');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] Cache failed:', err))
  );
});

// ===== ACTIVATE: Clean old caches =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ===== FETCH: Cache First, then Network =====
self.addEventListener('fetch', (event) => {
  // Skip non-GET and browser-extension requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Return from cache, update in background
        const fetchPromise = fetch(event.request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
              });
            }
            return response;
          })
          .catch(() => cached); // If offline, use cache

        return cached; // Return cached immediately
      }

      // Not in cache — fetch from network
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }

          // Cache the new response
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });

          return response;
        })
        .catch(() => {
          // Offline fallback — return cached index
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

// ===== PUSH NOTIFICATIONS (future-ready) =====
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json().catch(() => ({
    title: 'Azar Finance',
    body: 'Jangan lupa catat pengeluaran hari ini!',
  }));

  event.waitUntil(
    data.then((payload) =>
      self.registration.showNotification(payload.title || 'Azar Finance', {
        body: payload.body || 'Ada pengingat untuk Anda.',
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [200, 100, 200],
        tag: 'azar-reminder',
        renotify: true,
        data: { url: './' },
      })
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('./');
    })
  );
});
