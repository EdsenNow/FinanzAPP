/**
 * ServiceWorker helper — Registra el Service Worker de FinanzApp y limpia
 * caches obsoletas de versiones anteriores.
 *
 * El SW usa una estrategia network-first, por lo que los despliegues nuevos se
 * reflejan inmediatamente y el cache solo actúa como fallback offline.
 */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  /**
   * Elimina caches con nombres de versiones anteriores del SW.
   * Se ejecuta una sola vez por sesión para no penalizar el arranque.
   */
  function limpiarCachesObsoletas() {
    if (!('caches' in window)) return;
    const versionActual = 'v20260819_v3';
    caches.keys().then(names => {
      names.forEach(name => {
        if (!name.includes(versionActual)) {
          caches.delete(name);
        }
      });
    }).catch(() => {});
  }

  /**
   * Registra el Service Worker ubicado en /service-worker.js.
   */
  function registrarServiceWorker() {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => {
        console.log('[ServiceWorker] registrado:', reg.scope);
      })
      .catch(err => {
        console.warn('[ServiceWorker] registro fallido:', err);
      });
  }

  limpiarCachesObsoletas();

  // Se registra una vez el DOM esté listo para no bloquear el parseo.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registrarServiceWorker);
  } else {
    registrarServiceWorker();
  }
})();
