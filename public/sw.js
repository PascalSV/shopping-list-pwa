// src/client/sw.ts
var CACHE_NAME = "shopping-list-v1";
var urlsToCache = [
  "/",
  "/index.html",
  "/styles.css",
  "/assets/index.js",
  "/manifest.json"
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((response2) => {
        if (!response2 || response2.status !== 200 || response2.type !== "basic") {
          return response2;
        }
        const responseToCache = response2.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response2;
      }).catch(() => {
        return caches.match("/index.html").then((r) => r || new Response("Offline"));
      });
    })
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
