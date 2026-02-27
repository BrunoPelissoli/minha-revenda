/**
 * Service Worker v4
 * - HTML: network-first (evita ficar preso em versão antiga do layout)
 * - Assets estáticos (mesma origem e CDNs de libs): cache-first
 * - Requests de API (ex.: Supabase REST/Auth): network-only (NUNCA cacheia respostas de API)
 */
const CACHE_NAME = "bruno-vendas-pwa-v4";

const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",

  // CDNs (libs)
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
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
  return req.mode === "navigate" || req.destination === "document" || url.pathname.endsWith("/index.html");
}

function isSupabaseRequest(req) {
  const url = new URL(req.url);
  // Ajuste aqui se você usa um domínio customizado
  return (
    url.hostname.endsWith("supabase.co") ||
    url.pathname.includes("/rest/v1/") ||
    url.pathname.includes("/auth/v1/") ||
    url.pathname.includes("/storage/v1/")
  );
}

function isStaticAssetRequest(req) {
  // destination vazio geralmente é XHR/fetch (API) → não cachear
  const d = req.destination;
  return d === "script" || d === "style" || d === "image" || d === "font" || d === "manifest";
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // 1) Supabase/API: NETWORK ONLY
  if (isSupabaseRequest(event.request)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2) HTML: NETWORK FIRST
  if (isHTMLRequest(event.request)) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(event.request, { cache: "no-store" });
          const cache = await caches.open(CACHE_NAME);
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

  // 3) Assets estáticos: CACHE FIRST
  if (isStaticAssetRequest(event.request)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        const res = await fetch(event.request);
        if (res && res.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, res.clone());
        }
        return res;
      })()
    );
    return;
  }

  // 4) Outros fetch/xhr: NETWORK ONLY
  event.respondWith(fetch(event.request));
});
