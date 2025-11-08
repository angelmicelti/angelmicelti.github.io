const CACHE_NAME = 'tecnovilladiego-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/base.css',
  '/content.css',
  '/nav.css',
  '/exe_jquery.js',
  '/common_i18n.js',
  '/common.js',
  '/favicon.ico',
  // Añade aquí otros recursos que quieras cachear
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});