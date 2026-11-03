/* OrderPilot service worker (hand-written, no build step).
 *
 * Strategies:
 *  - App shell (precached on install): start page, offline page, manifest, icons.
 *  - Page navigations: network-first, falling back to the cached page, then /offline.
 *  - Next.js build assets (/_next/static/*, content-hashed): cache-first.
 *  - Manifest and icons: network-first with cache fallback.
 *  - Catalog GETs on core-api (/api/products…): network-first with cache fallback, so reps can
 *    browse products and stock offline.
 * Everything else (orders, chat, auth) always goes to the network.
 */

const VERSION = "v1";
const SHELL_CACHE = `orderpilot-shell-${VERSION}`;
const RUNTIME_CACHE = `orderpilot-runtime-${VERSION}`;
const CATALOG_CACHE = `orderpilot-catalog-${VERSION}`;
const SHELL_URLS = ["/", "/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, RUNTIME_CACHE, CATALOG_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function handleNavigation(request) {
  try {
    return await networkFirst(request, RUNTIME_CACHE);
  } catch {
    return (await caches.match(request)) || (await caches.match("/offline")) || Response.error();
  }
}

function isShellAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/icons/") || /^\/(icon|apple-icon)\b/.test(url.pathname))
  );
}

function isCatalogRequest(url) {
  return /\/api\/products(\/|$|\?)/.test(url.pathname + url.search);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  if (isShellAsset(url)) {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  if (isCatalogRequest(url)) {
    event.respondWith(networkFirst(request, CATALOG_CACHE));
  }
});
