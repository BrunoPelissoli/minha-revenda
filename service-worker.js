const CACHE_NAME = "bruno-vendas-pwa-v2";

// Mantenha esta lista alinhada com os arquivos do seu repositório/GitHub Pages
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",

  // CDNs usados no index.html
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

function isHTMLRequest(req) {
  const url = new URL(req.url);
  return (
    req.mode === "navigate" ||
    req.destination === "document" ||
    url.pathname.endsWith("/index.html")
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // HTML/navegação: NETWORK FIRST (evita ficar preso em layout antigo)
  if (isHTMLRequest(event.request)) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(event.request, { cache: "no-store" });
          const cache = await caches.open(CACHE_NAME);
          // padroniza chave do HTML para facilitar fallback
          cache.put("./index.html", res.clone());
          return res;
        } catch (e) {
          const cached = await caches.match("./index.html");
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Demais assets: CACHE FIRST
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;

      try {
        const res = await fetch(event.request);
        if (res && res.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, res.clone());
        }
        return res;
      } catch (e) {
        return cached || Response.error();
      }
    })()
  );
});
