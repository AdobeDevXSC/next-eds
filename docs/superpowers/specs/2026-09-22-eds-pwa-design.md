# EDS PWA — Service Worker & Installability

**Date:** 2026-09-22
**Status:** Approved (design)

## Goal

Make the site installable as a Progressive Web App and work offline, wired
**only** through the classic Edge Delivery Services (EDS) pipeline
(`*.aem.page` / `*.aem.live` and `localhost:3000`). The Next.js/RSC surface is
intentionally left untouched.

## Constraints & context

- EDS serves static files directly from the repo root (except paths matched by
  `.hlxignore`). A file at repo root `sw.js` is served at `/sw.js` with root
  scope (`/`).
- `.hlxignore` currently ignores `.*`, `*.md`, `karma.config.js`, `LICENSE`,
  `package.json`, `package-lock.json`, `test/*`. None of the new PWA files match
  those patterns, so no change is required.
- The three-phase loader in `scripts/scripts.js` calls `loadDelayed()`, which
  dynamically imports `scripts/delayed.js` ~3s after load. This is the correct,
  zero-LCP-impact place to register the service worker.
- CSP in `head.html` sets `script-src 'nonce-aem' 'strict-dynamic'
  'unsafe-inline' http: https:`. Same-origin worker fetch falls back to
  `script-src` (no `worker-src`/`child-src`/`default-src` set), and `http:` /
  `https:` permit it. `delayed.js` is trusted via `'strict-dynamic'` because it
  is dynamically imported from the nonce'd `scripts.js`.
- Only `favicon.ico` and `icons/search.svg` exist today — no PWA icons or
  manifest.

## Files

| File | Purpose |
|------|---------|
| `manifest.webmanifest` (root) | App metadata: `name`, `short_name`, `start_url: /`, `display: standalone`, `theme_color`, `background_color`, `icons`. |
| `sw.js` (root) | Service worker: precache app shell + runtime caching. Root scope. |
| `offline.html` (root) | Static fallback shown when a navigation fails offline and is not cached. |
| `icons/icon-192.png` | 192×192 icon (generated from `favicon.ico`). |
| `icons/icon-512.png` | 512×512 icon. |
| `icons/icon-maskable-512.png` | 512×512 maskable icon (`purpose: maskable`). |
| `head.html` | Add `<link rel="manifest" href="/manifest.webmanifest">` and `<meta name="theme-color">`. |
| `scripts/delayed.js` | Register the service worker. |

Icons are generated as placeholders from `favicon.ico` using available macOS
tooling (`sips`); they can be swapped for real branding later without code
changes.

## Service worker behavior (cache-first, versioned)

- **Versioned cache name** — a single constant (e.g. `eds-pwa-v1`). Bumping the
  version is the lever that invalidates all caches. Documented in a comment
  block at the top of `sw.js`.
- **`install`**: precache the app shell and `skipWaiting()`. App shell:
  `/`, `/offline.html`, `/scripts/aem.js`, `/scripts/scripts.js`,
  `/styles/styles.css`, `/styles/lazy-styles.css`, the three icons.
  Precache is best-effort per URL so one failed asset does not abort install.
- **`activate`**: delete any cache whose name ≠ the current version, then
  `clients.claim()`.
- **`fetch`** — only same-origin `GET`; everything else (cross-origin, non-GET,
  Sidekick/admin) passes through untouched:
  - **Navigation requests (HTML):** stale-while-revalidate. Serve the cached
    page immediately if present, and fetch a fresh copy in the background to
    update the cache. On a full miss with no network, respond with
    `/offline.html`.
  - **Static assets** (scripts, styles, fonts, icons, images): cache-first;
    on a cache miss, fetch, cache, and return.

The navigations use stale-while-revalidate (rather than pure cache-first) so
pages self-heal on the next visit — the practical mitigation for EDS content
staleness. Static assets remain strictly cache-first.

## Update flow

Because static assets are cache-first, code changes surface once the SW updates.
Handled by `skipWaiting()` + `clients.claim()` on activate (new SW takes over
promptly) plus bumping the cache-version constant on each meaningful release
(purges stale caches on activate).

## Registration (`scripts/delayed.js`)

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
```

Runs in the delayed phase → no LCP impact. Failures are swallowed so a SW
problem never breaks the page.

## Testing

- Local `aem up`: confirm `/sw.js` and `/manifest.webmanifest` are served;
  SW registers; manifest validates; native install prompt is available;
  DevTools → Offline serves cached pages and `/offline.html` for uncached
  routes.
- Lighthouse PWA / installability audit.

## Non-goals (YAGNI)

- No custom "Install app" button — the manifest alone drives the browser's
  native install prompt.
- No push notifications, background sync, or Next.js/RSC integration.
