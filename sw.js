// IMPORTANTE: subir este número cada vez que se despliegue un cambio (va en pareja con APP_VERSION del index.html)
const CACHE = "nutri-pol-v4";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const req = e.request;
  const isHTML = req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") !== -1;

  // HTML / navigation: network-first so updates show immediately, cache as offline fallback
  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy));
          return resp;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
    );
    return;
  }

  // Static assets + fonts: cache-first with runtime caching
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          const url = req.url;
          const isFont = url.indexOf("fonts.g") !== -1;
          // Las peticiones no-CORS a Google Fonts devuelven respuestas "opacas" (status 0): hay que aceptarlas o nunca se cachean
          const cacheable = resp && (resp.status === 200 || (isFont && resp.type === "opaque"));
          if (cacheable && (url.startsWith(self.location.origin) || isFont)) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return resp;
        })
        .catch(() => undefined);
    })
  );
});
