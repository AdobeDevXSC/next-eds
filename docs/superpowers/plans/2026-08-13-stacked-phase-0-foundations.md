# Stacked Phase 0 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the Brick Stack foundations on the running site — self-hosted brand fonts, brand tokens applied to the existing blocks, and an installable PWA — so later phases build on a branded, installable shell.

**Architecture:** This is an AEM Edge Delivery site rendered by Next.js 16 App Router + RSC on Cloudflare Workers (OpenNext). Global CSS + tokens live in `styles/`; per-block CSS in `blocks/<name>/`. Fonts are self-hosted from `public/fonts` and declared in `styles/tokens/fonts.css`. PWA metadata is emitted through the Next Metadata API in `app/layout.js` + an `app/manifest.js` route; the service worker and icons are static assets under `public/`.

**Tech Stack:** Next.js 16, React 19 (RSC + a few `'use client'` islands), vanilla CSS with custom properties, OpenNext on Cloudflare Workers, ESLint (airbnb-base) + Stylelint (standard). Design system: [DESIGN.md](../../DESIGN.md).

## Global Constraints

- No transpiled/framework CSS; plain CSS with custom properties, Stylelint standard, mobile-first (`min-width` at 600/900/1200px), selectors scoped to the block. Section/layout CSS goes in `styles/styles.css`, not block CSS.
- ES6+ JS, Airbnb ESLint, always include `.js` extensions in imports, Unix (LF) line endings.
- Brand contract (from [DESIGN.md](../../DESIGN.md)): theme color / hero = Punch `#ff5a2c`; page ground = Counter `#f8f7f4`; ink = Char `#1a1714`; dark ink on bright bricks (Grape `#7a3ff2` is the only white-text brick); two-layer stack shadow with a `translateY(3px)` snap-settle; brick radii; display = Bricolage Grotesque, body = Hanken Grotesk.
- `npm run lint` (eslint + stylelint) MUST stay green after every task.
- No unit-test runner exists in this repo. Each task is verified with: `npm run lint`, the dev/preview server, `curl`, and browser checks (the executor's Browser/Playwright tools). Treat those as the test gates.
- Some tooling needs Node ≥ 22 (`nvm use 22`); the default shell Node here is 20. Use Node 22 for `next build` / `opennextjs-cloudflare` if the default errors.
- Accessibility: WCAG 2.1 AA; text contrast ≥ 4.5:1.
- Keep committed binary assets (fonts, icons) optimized/small.

## File Structure

- `styles/tokens/fonts.css` — replace Roboto `@font-face` with Bricolage + Hanken (self-hosted). Owns webfont declarations.
- `styles/tokens/typography.css` — simplify the two family stacks (drop the undefined `*Fallback` names). (Modify only.)
- `public/fonts/*.woff2` — self-hosted brand font files (new).
- `blocks/*/*.css` — swap hardcoded neutral/semantic colors for tokens (modify only; enumerated in Task 2).
- `app/layout.js` — root layout; add PWA `metadata`/`viewport`, font preload, and mount the SW registrar.
- `app/manifest.js` — Next manifest route → `/manifest.webmanifest` (new).
- `app/ServiceWorkerRegister.jsx` — `'use client'` island that registers `/sw.js` (new).
- `public/icons/*` — icon source SVGs + generated PNGs (new).
- `scripts/gen-icons.mjs` — one-off icon rasterizer (new; dev-only).
- `public/sw.js` — service worker: precache shell, network-first navigations, offline fallback (new).
- `public/offline.html` — branded offline fallback page (new).

---

### Task 1: Self-host Bricolage Grotesque + Hanken Grotesk

**Files:**
- Create: `public/fonts/bricolage-grotesque-variable.woff2`, `public/fonts/hanken-grotesk-variable.woff2`
- Modify: `styles/tokens/fonts.css` (replace Roboto faces), `styles/tokens/typography.css` (family stacks), `app/layout.js` (preload)
- Verify: dev server + browser computed style + `curl`

**Interfaces:**
- Produces: the CSS families `'Bricolage Grotesque'` and `'Hanken Grotesk'` resolve to real self-hosted webfonts. The token names `--heading-font-family` / `--body-font-family` are unchanged (already point at these families).

- [ ] **Step 1: Obtain the font files (Fontsource, self-hosted).** Install the variable packages as dev dependencies and find the latin woff2:

```bash
npm i -D @fontsource-variable/bricolage-grotesque @fontsource-variable/hanken-grotesk
ls node_modules/@fontsource-variable/bricolage-grotesque/files/ | grep -i latin
ls node_modules/@fontsource-variable/hanken-grotesk/files/ | grep -i latin
```

Expected: each lists a latin variable file, e.g. `bricolage-grotesque-latin-*-normal.woff2` and `hanken-grotesk-latin-wght-normal.woff2` (exact axis token varies — use what `ls` prints).

- [ ] **Step 2: Copy the latin woff2 into `public/fonts` with stable names.** Substitute the real filenames from Step 1:

```bash
cp node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-*-normal.woff2 public/fonts/bricolage-grotesque-variable.woff2
cp node_modules/@fontsource-variable/hanken-grotesk/files/hanken-grotesk-latin-wght-normal.woff2 public/fonts/hanken-grotesk-variable.woff2
ls -la public/fonts/*.woff2
```

Expected: both files exist under `public/fonts/`.

- [ ] **Step 3: Verify the files are NOT yet served under the app font family.** Start the dev server (background) and curl the new paths:

```bash
npm run dev &   # next dev on http://localhost:3000
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/fonts/bricolage-grotesque-variable.woff2
```

Expected: `200` (public/ is served at `/`). If `404`, the copy path is wrong — fix Step 2.

- [ ] **Step 4: Replace the Roboto `@font-face` block in `styles/tokens/fonts.css`** with the two variable faces (keep the file's opening comment updated):

```css
/* Stacked webfonts — Bricolage Grotesque (display) + Hanken Grotesk (body).
   Self-hosted variable woff2 in /public/fonts (served at /fonts/...). */

@font-face {
  font-family: 'Bricolage Grotesque';
  font-style: normal;
  font-weight: 400 800;
  font-display: swap;
  src: url('/fonts/bricolage-grotesque-variable.woff2') format('woff2');
}

@font-face {
  font-family: 'Hanken Grotesk';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('/fonts/hanken-grotesk-variable.woff2') format('woff2');
}
```

- [ ] **Step 5: Simplify the family stacks in `styles/tokens/typography.css`** so they don't reference undefined fallback faces. Replace the two family lines:

```css
  --body-font-family: 'Hanken Grotesk', system-ui, -apple-system, sans-serif;
  --heading-font-family: 'Bricolage Grotesque', system-ui, -apple-system, sans-serif;
```

(Leave `--fixed-font-family` as-is.)

- [ ] **Step 6: Preload the display font in `app/layout.js`.** Inside the returned JSX, add a preload link as the first child of `<body>` (React 19 hoists it to `<head>`):

```jsx
<body className="appear">
  <link
    rel="preload"
    href="/fonts/bricolage-grotesque-variable.woff2"
    as="font"
    type="font/woff2"
    crossOrigin="anonymous"
  />
  {children}
</body>
```

- [ ] **Step 7: Verify headings render in Bricolage.** With the dev server running, use the Browser tool to open `http://localhost:3000/` and evaluate:

```js
getComputedStyle(document.querySelector('h1, h2')).fontFamily
```

Expected: the string contains `"Bricolage Grotesque"`. Also confirm the woff2 requests return 200 in the network panel.

- [ ] **Step 8: Lint.**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 9: Commit.**

```bash
git add public/fonts/*.woff2 styles/tokens/fonts.css styles/tokens/typography.css app/layout.js package.json package-lock.json
git commit -m "feat(brand): self-host Bricolage + Hanken webfonts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Apply Brick Stack tokens to the blocks

Swap hardcoded neutral/semantic colors in block CSS for the brand tokens (the token values already changed in `styles/tokens/*`; these blocks bypass them with literals). Leave functional scrims/overlays (translucent black/white) alone.

**Files:**
- Modify: `blocks/accordion/accordion.css`, `blocks/table/table.css`, `blocks/search/search.css`, `blocks/form/form.css`, `blocks/callout/callout.css`, `blocks/header/header.css`
- Verify: `npm run lint` + browser screenshot

**Interfaces:**
- Produces: no API surface; visual only. Blocks inherit the Brick Stack palette via `var(--border-color)` / brand tokens.

- [ ] **Step 1: Confirm the current hardcoded colors exist.**

```bash
grep -rnE '#dadada|#d1d1d1|#b7791f|#2f855a|color: ?#fff' blocks/accordion/accordion.css blocks/table/table.css blocks/search/search.css blocks/form/form.css blocks/callout/callout.css blocks/header/header.css
```

Expected: matches in each file (the lines edited below).

- [ ] **Step 2: Replace neutral border literals with the border token.** In `blocks/accordion/accordion.css`, `blocks/table/table.css`, and `blocks/search/search.css`, replace every `#dadada` with `var(--border-color)`. In `blocks/form/form.css`, replace every `#d1d1d1` with `var(--border-color)`.

Use replace-all per file, e.g.:

```bash
sed -i '' 's/#dadada/var(--border-color)/g' blocks/accordion/accordion.css blocks/table/table.css blocks/search/search.css
sed -i '' 's/#d1d1d1/var(--border-color)/g' blocks/form/form.css
```

- [ ] **Step 3: Map the callout semantic borders to brand tokens.** In `blocks/callout/callout.css`, replace the warning border `#b7791f` with `var(--brand-sun)` and the success border `#2f855a` with `var(--brand-zest)`:

```bash
sed -i '' 's/#b7791f/var(--brand-sun)/g; s/#2f855a/var(--brand-zest)/g' blocks/callout/callout.css
```

(Note: the craft floor discourages thick colored `border-left` on callouts; a structural redesign is deferred to Phase 5. This step only re-colors.)

- [ ] **Step 4: Use the inverse-text token in the header.** In `blocks/header/header.css`, replace the bare `color: #fff` (the active mega-menu link) with `color: var(--text-inverse)`:

```bash
sed -i '' 's/color: #fff/color: var(--text-inverse)/g' blocks/header/header.css
```

- [ ] **Step 5: Confirm no unintended literals remain** (functional scrims in carousel/modal/hero and the translucent header background are intentionally left):

```bash
grep -rnE '#dadada|#d1d1d1|#b7791f|#2f855a' blocks/*/*.css
```

Expected: no output.

- [ ] **Step 6: Lint.**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 7: Visual check.** With the dev server running, open `http://localhost:3000/` in the Browser tool and screenshot the header, a `cards` block, and a `callout` if present. Confirm borders read as the warm hairline (`#e4dfd5`) and nothing looks like the old cool gray. Confirm the primary button is Punch with dark ink.

- [ ] **Step 8: Commit.**

```bash
git add blocks/accordion/accordion.css blocks/table/table.css blocks/search/search.css blocks/form/form.css blocks/callout/callout.css blocks/header/header.css
git commit -m "style(blocks): use Brick Stack tokens instead of hardcoded colors

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: PWA manifest + icons

**Files:**
- Create: `public/icons/icon.svg`, `public/icons/icon-maskable.svg`, `scripts/gen-icons.mjs`, generated `public/icons/icon-192.png` / `icon-512.png` / `icon-maskable-512.png` / `apple-touch-icon.png`
- Create: `app/manifest.js`
- Modify: `app/layout.js` (metadata + viewport theme color + apple/icons)
- Verify: `curl /manifest.webmanifest`, icon 200s, browser install check

**Interfaces:**
- Produces: `GET /manifest.webmanifest` (valid PWA manifest), icon assets under `/icons/*`, and `<link rel="manifest">` + `theme-color` + apple-touch meta in the document head.

- [ ] **Step 1: Author the icon source SVGs.** Create `public/icons/icon.svg` — the Stacked brick mark on Counter (rounded square + two stack bars in Punch), ~10% padding:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#f8f7f4"/>
  <rect x="128" y="176" width="256" height="64" rx="24" fill="#ff5a2c"/>
  <rect x="128" y="272" width="256" height="64" rx="24" fill="#1a1714"/>
</svg>
```

Create `public/icons/icon-maskable.svg` — full-bleed Punch background with the mark centered at ~60% (safe zone for maskable):

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#ff5a2c"/>
  <rect x="160" y="200" width="192" height="48" rx="18" fill="#1a1714"/>
  <rect x="160" y="272" width="192" height="48" rx="18" fill="#f8f7f4"/>
</svg>
```

- [ ] **Step 2: Write the rasterizer** `scripts/gen-icons.mjs` (dev-only; uses `sharp`):

```js
import sharp from 'sharp';

const jobs = [
  ['public/icons/icon.svg', 'public/icons/icon-192.png', 192],
  ['public/icons/icon.svg', 'public/icons/icon-512.png', 512],
  ['public/icons/icon.svg', 'public/icons/apple-touch-icon.png', 180],
  ['public/icons/icon-maskable.svg', 'public/icons/icon-maskable-512.png', 512],
];

await Promise.all(jobs.map(([src, out, size]) =>
  sharp(src).resize(size, size).png({ compressionLevel: 9 }).toFile(out)));

console.log('icons written');
```

- [ ] **Step 3: Generate the PNGs** (sharp is dev-only; commit the outputs, not a runtime dep):

```bash
npm i -D sharp
node scripts/gen-icons.mjs
ls -la public/icons/*.png
```

Expected: four PNGs written. (If `sharp` fails to install here, run the script under Node 22.)

- [ ] **Step 4: Create the manifest route** `app/manifest.js`:

```js
export default function manifest() {
  return {
    name: 'Stacked',
    short_name: 'Stacked',
    description: 'Build your lunch, brick by brick.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f7f4',
    theme_color: '#ff5a2c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```

- [ ] **Step 5: Add PWA metadata to `app/layout.js`.** Update the `metadata` export and add a `viewport` export (Next 16 puts `themeColor` on `viewport`):

```js
export const metadata = {
  title: 'Stacked',
  description: 'Build your lunch, brick by brick.',
  applicationName: 'Stacked',
  appleWebApp: { capable: true, title: 'Stacked', statusBarStyle: 'default' },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#ff5a2c',
};
```

(Next auto-emits `<link rel="manifest" href="/manifest.webmanifest">` because `app/manifest.js` exists.)

- [ ] **Step 6: Verify the manifest + icons serve.** With the dev server running:

```bash
curl -s http://localhost:3000/manifest.webmanifest | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const m=JSON.parse(s);console.log('name',m.name,'| theme',m.theme_color,'| icons',m.icons.length)})"
curl -s -o /dev/null -w "icon-512 %{http_code}\n" http://localhost:3000/icons/icon-512.png
```

Expected: `name Stacked | theme #ff5a2c | icons 3` and `icon-512 200`.

- [ ] **Step 7: Verify head tags.** In the Browser tool at `http://localhost:3000/`, evaluate:

```js
({ manifest: document.querySelector('link[rel=manifest]')?.href,
   theme: document.querySelector('meta[name=theme-color]')?.content })
```

Expected: a manifest href ending `/manifest.webmanifest` and theme `#ff5a2c`.

- [ ] **Step 8: Lint.**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 9: Commit.**

```bash
git add app/manifest.js app/layout.js public/icons scripts/gen-icons.mjs package.json package-lock.json
git commit -m "feat(pwa): add web manifest, brand icons, and theme color

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Service worker + offline shell

**Files:**
- Create: `public/sw.js`, `public/offline.html`, `app/ServiceWorkerRegister.jsx`
- Modify: `app/layout.js` (mount the registrar)
- Verify: browser SW registration + offline navigation + `npm run preview:cf`

**Interfaces:**
- Consumes: the manifest/icons from Task 3.
- Produces: a registered service worker at `/sw.js` (root scope) that serves `/offline.html` when a navigation fails.

- [ ] **Step 1: Write the branded offline page** `public/offline.html` (self-contained; inline styles so it works with no network):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Offline — Stacked</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center;
        background: #f8f7f4; color: #1a1714; font-family: system-ui, sans-serif; text-align: center; }
      .card { background: #fff; border-radius: 20px; padding: 32px 28px;
        box-shadow: 0 5px 0 -2px rgb(26 23 20 / 7%), 0 14px 26px -10px rgb(26 23 20 / 20%); }
      .brick { width: 120px; height: 20px; border-radius: 8px; background: #ff5a2c; margin: 0 auto 8px; }
      .brick.two { background: #1a1714; width: 120px; }
      h1 { font-size: 22px; margin: 16px 0 4px; }
      p { color: #615c54; margin: 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brick"></div>
      <div class="brick two"></div>
      <h1>You're offline</h1>
      <p>Reconnect to keep stacking. Your cart is saved.</p>
    </div>
  </body>
</html>
```

- [ ] **Step 2: Write the service worker** `public/sw.js` (conservative: precache the offline page + icons; network-first for navigations with the offline fallback; cache-first for same-origin static assets). Keep it dependency-free:

```js
const CACHE = 'stacked-shell-v1';
const PRECACHE = ['/offline.html', '/icons/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline.html')));
    return;
  }

  const url = new URL(request.url);
  if (url.origin === self.location.origin && /\.(?:woff2|png|svg|css|js)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })),
    );
  }
});
```

- [ ] **Step 3: Write the registrar** `app/ServiceWorkerRegister.jsx`:

```jsx
'use client';

import { useEffect } from 'react';

// Registers the service worker after load. Renders nothing. Skipped in dev to avoid
// stale-cache confusion; only registers on the deployed origin.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return undefined;
    if (!('serviceWorker' in navigator)) return undefined;
    const onLoad = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
```

- [ ] **Step 4: Mount the registrar in `app/layout.js`.** Import it and render it inside `<body>` after `{children}`:

```jsx
import ServiceWorkerRegister from './ServiceWorkerRegister.jsx';
// ...
<body className="appear">
  {/* preload link from Task 1 */}
  {children}
  <ServiceWorkerRegister />
</body>
```

- [ ] **Step 5: Lint.**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 6: Build + run the Cloudflare preview** (SW only registers in production build):

```bash
npm run preview:cf   # opennextjs-cloudflare build && preview  (use nvm use 22 if needed)
```

Expected: builds and serves a local Worker URL.

- [ ] **Step 7: Verify registration + offline fallback.** In the Browser tool, open the preview URL, then evaluate after load:

```js
navigator.serviceWorker.getRegistration().then((r) => !!r)
```

Expected: `true`. Then, in DevTools/Network set offline and reload a route — expect the branded `/offline.html` to render. Optionally run a Lighthouse "installable" / PWA check and confirm no installability errors.

- [ ] **Step 8: Commit.**

```bash
git add public/sw.js public/offline.html app/ServiceWorkerRegister.jsx app/layout.js
git commit -m "feat(pwa): register a service worker with an offline shell

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 0 acceptance

- Headings render in Bricolage Grotesque, body in Hanken Grotesk, both self-hosted (no CDN font requests).
- Blocks show the Brick Stack palette; `grep` finds no stray `#dadada`/`#d1d1d1`/callout literals; primary button is Punch with dark ink.
- `GET /manifest.webmanifest` is valid (name Stacked, theme `#ff5a2c`, 3 icons incl. maskable); head carries the manifest link + theme-color + apple-touch icon.
- On the Cloudflare preview, the service worker registers and a failed navigation serves the branded offline page; Lighthouse reports the app installable with no errors.
- `npm run lint` is green.

## Not in this phase (next up)

- Phase 1 — Catalog: `menu` index authoring, `lib/catalog.js`, `/menu` route, home menu highlight, `catalog` revalidation. See the [demo spec](../specs/2026-08-13-stacked-demo-design.md) §11.
