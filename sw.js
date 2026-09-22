/* eslint-env serviceworker */
/* eslint-disable no-restricted-globals -- `self` is the service-worker global scope */
/*
 * Service worker for the EDS (Edge Delivery Services) surface.
 *
 * Strategy (see docs/superpowers/specs/2026-09-22-eds-pwa-design.md):
 *   - Static assets (scripts/styles/fonts/icons/images): cache-first.
 *   - Navigations (HTML): stale-while-revalidate — serve the cached page
 *     instantly, refresh it in the background; fall back to /offline.html.
 *
 * Updating: bump CACHE_VERSION to invalidate every cache on the next activate.
 * During local `aem up` development, cache-first static assets can hide edits —
 * unregister the worker (DevTools > Application > Service Workers) or bump the
 * version to force a refresh.
 */
const CACHE_VERSION = 'v1';
const CACHE = `eds-pwa-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// App shell precached on install. Each entry is best-effort so one missing
// asset never aborts the whole install.
const PRECACHE = [
  '/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/scripts/aem.js',
  '/scripts/scripts.js',
  '/styles/styles.css',
  '/styles/lazy-styles.css',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

const ASSET_RE = /\.(?:woff2?|ttf|otf|png|jpe?g|webp|gif|svg|css|js|json|webmanifest)$/;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Serve the cached page immediately, revalidate in the background, fall back to
// the offline page when there is nothing cached and the network is unavailable.
async function handleNavigate(request, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  if (cached) {
    // Keep the background revalidation alive after we return the cached page.
    event.waitUntil(network);
    return cached;
  }
  const res = await network;
  return res || cache.match(OFFLINE_URL);
}

// Cache-first: return the cached asset, otherwise fetch and cache it.
async function handleAsset(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigate(request, event));
    return;
  }

  if (ASSET_RE.test(url.pathname)) {
    event.respondWith(handleAsset(request));
  }
});
