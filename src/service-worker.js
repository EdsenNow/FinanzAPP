const CACHE_VERSION = 'v20260819_v3';
const STATIC_CACHE = `finanzapp-static-${CACHE_VERSION}`;
const SHELL_CACHE = `finanzapp-shell-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/pages/Login/Login.html',
  '/__config.js',
  '/lib/fonts.css'
];

const STATIC_EXTENSIONS = /\.(css|js|woff2?|png|jpg|jpeg|gif|svg|ico|webmanifest|json)$/;

// Precache del shell durante install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Limpiar caches antiguas y tomar control de clientes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== SHELL_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return (
    url.startsWith('https://firestore.googleapis.com') ||
    url.startsWith('https://identitytoolkit.googleapis.com') ||
    url.includes('cloudfunctions.net') ||
    url.includes('googleapis.com')
  );
}

function isThirdPartyAuthScript(url) {
  return (
    url.startsWith('https://www.google.com/recaptcha') ||
    url.startsWith('https://apis.google.com/js/') ||
    url.startsWith('https://accounts.google.com/gsi/')
  );
}

function isChromeExtension(url) {
  return url.startsWith('chrome-extension://') || url.startsWith('moz-extension://');
}

// Network-first para todos los recursos para garantizar que los cambios se desplieguen inmediatamente.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (isApiRequest(url.href)) return;
  if (isThirdPartyAuthScript(url.href)) return;
  if (isChromeExtension(url.href)) return;

  // HTML: network-first, fallback a cache
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(response =>
            response || caches.match('/index.html')
          )
        )
    );
    return;
  }

  // CSS/JS/Fonts/Imágenes: network-first, fallback a cache
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
