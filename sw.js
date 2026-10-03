/* ==========================================================================
   Service Worker - Repositorio de TecnoVilladiego (PWA)
   --------------------------------------------------------------------------
   Estrategias de caché:
   - Navegación (páginas .html): Network-first (con respaldo en caché y
     página offline.html si no hay conexión ni copia en caché).
   - Recursos same-origin (css, js, imágenes, iconos): Stale-while-revalidate
     (sirve rápido desde caché y actualiza en segundo plano).
   - Peticiones cross-origin: no se interceptan (pasan directo a la red).
   Para actualizar la app en el futuro, sube la versión del CACHE_NAME.
   ========================================================================== */

'use strict';

const CACHE_NAME = 'tecnovilladiego-v1.6.0';
<<<<<<< Updated upstream

/* Prefijo de LAS PROPIAS cachés: en la activación solo se borran cachés con
   este prefijo, nunca las de otras aplicaciones alojadas en el mismo origen
   (la Cache Storage es compartida por todo el dominio). */
const CACHE_PREFIX = 'tecnovilladiego-';

/* Carpetas que forman parte de este portal. Cualquier otra ruta del dominio
   (p. ej. /NumerosMetalicos/, /Reducciones/... apps de otros repositorios
   servidas en usuario.github.io/<repo>) NO se intercepta: su gestión queda
   totalmente fuera de este service worker. */
const CARPETAS_DEL_PORTAL = [
  '2ESO', '3ESO', '4ESO', 'CYR', 'DOC', 'HER', 'PROY', 'icons', 'w3images'
];

function perteneceAlPortal(url) {
  const segmentos = url.pathname.split('/').filter(Boolean);
  if (segmentos.length === 0) return true; // raíz del portal
  return CARPETAS_DEL_PORTAL.includes(segmentos[0]);
}
=======
>>>>>>> Stashed changes

/* Recursos esenciales que se pre-cachean en la instalación.
   Se usa precache tolerante: si un recurso falla, la instalación
   no se rompe (importante en sitios grandes como este). */
const PRECACHE_ASSETS = [
  './',
  'index.html',
  'offline.html',
  'manifest.json',
  'favicon.ico',
  'responsive.css',
  'responsive.js',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'icons/maskable-icon-512x512.png'
];

/* Instalación: pre-cachea los recursos esenciales y activa el SW nuevo. */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_ASSETS.map((asset) =>
            cache.add(new Request(asset, { cache: 'reload' }))
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

/* Activación: elimina cachés de versiones anteriores y toma el control. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key.startsWith(CACHE_PREFIX))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* Permite forzar la activación inmediata de una versión nueva:
   newWorker.postMessage({ type: 'SKIP_WAITING' }); */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/* Intercepción de peticiones. */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Peticiones de otro origen (widgets externos, imágenes externas): red directa
  if (url.origin !== self.location.origin) return;

  // Rutas de otras aplicaciones del dominio: no se tocan en absoluto
  if (!perteneceAlPortal(url)) return;

  // 1) Navegación entre páginas: network-first con respaldo offline
  if (request.mode === 'navigate' ||
      (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Solo se cachean respuestas válidas (nunca errores 4xx/5xx)
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request, { ignoreSearch: true })
            .then((cached) =>
              (cached && cached.ok) ? cached : caches.match('offline.html')
            )
        )
    );
    return;
  }

  // 2) Resto de recursos same-origin: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
