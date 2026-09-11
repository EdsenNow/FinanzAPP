/**
 * FinanzApp Modern Service Worker
 * --------------------------------
 * Estrategia de caché balanceada y resiliente:
 *  - Network-First para navegación HTML (garantiza siempre la última versión online, offline fallback).
 *  - Stale-While-Revalidate para recursos estáticos locales (CSS, JS, iconos, fuentes).
 *  - Network-Only bypass para Firebase Auth, Firestore y APIs bancarias.
 */

const CACHE_NAME = 'finanzapp-cache-v2.3.8';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/Icons/android-chrome-192x192.png',
  '/Icons/android-chrome-512x512.png',
  '/Icons/favicon.ico',
  '/assets/logo-oscuro-square.png',
  '/assets/logo-claro-square.png',
  '/css/theme.css',
  '/css/shared.css'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Fallo precaché inicial de algunos recursos (no crítico):', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Eliminando caché obsoleta:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignorar peticiones que no sean GET
  if (request.method !== 'GET') return;

  // 2. Network-Only Bypass: Firebase Auth, Google APIs, extensiones y backend sincronizador
  if (
    url.protocol.startsWith('chrome-extension') ||
    url.pathname.startsWith('/__/auth') ||
    url.pathname.includes('/pages/Login') ||
    url.pathname.includes('FirebaseAuth') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('accounts.google.com') ||
    url.hostname.includes('apis.google.com') ||
    url.hostname.includes('cloudfunctions.net') ||
    url.pathname.includes('/syncImap') ||
    url.pathname.includes('/__config.js')
  ) {
    return;
  }

  // 3. Peticiones de navegación (HTML): Network-First con fallback a caché
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match('/index.html');
          return fallback || Response.error();
        })
    );
    return;
  }

  // 4. Recursos estáticos locales: Stale-While-Revalidate
  const isStaticAsset =
    url.origin === self.location.origin &&
    (/\.(css|js|png|jpg|jpeg|svg|ico|woff2?|webp)$/i.test(url.pathname) ||
      url.pathname.startsWith('/Icons/') ||
      url.pathname.startsWith('/css/') ||
      url.pathname.startsWith('/lib/'));

  if (isStaticAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});
