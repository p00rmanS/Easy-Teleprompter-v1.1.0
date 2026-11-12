const CACHE_NAME = "easy-teleprompter-v4";
// This worker is served from <base>service-worker.js, so its directory is the app's base path:
// "/" on a root host (Netlify) or "/repo-name/" on a GitHub Pages project site.
const BASE = new URL("./", self.location.href).pathname;
const APP_SHELL = ["manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"].map((file) => BASE + file);

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    const response = await fetch(BASE, { cache: "no-store" });
    if (response.ok) {
      const html = await response.clone().text();
      await cache.put(BASE, response);
      const paths = [...html.matchAll(/(?:src|href)=["']([^"']*\/assets\/[^"']+)["']/g)].map((match) => match[1]);
      await Promise.all([...new Set(paths)].map(async (path) => {
        try { await cache.add(path); } catch { /* Nonessential asset. */ }
      }));
    }
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(BASE, copy));
      }
      return response;
    }).catch(() => caches.match(BASE)));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
