# Feature Flags + Authenticated Ordering & Loyalty — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DA-controlled feature-flag system (first flag: `loyalty`) and, gated by it, authenticated ordering + a loyalty program — menu item pages with add-to-cart, a server/KV-backed cart, signed-in state and loyalty stamps in the header, and earn-on-order.

**Architecture:** Flags live as one JSON doc in KV (`APP_KV` key `flags`), written by an admin-key-protected `POST /api/flags` (which `revalidateTag('flags')`), read at runtime by `lib/flags.js` `getFlags()`. A static DA app at `/flags-app.html` toggles them. Ordering unifies on the existing `lib/cart.js` server/KV cart: a new `/api/cart` route is the mutation surface, and `OrderProvider` is refactored from localStorage to a thin client cache over it. The `(site)` layout (already async) feeds `getCurrentUser()` + `getFlags()` into `AppShell` for the signed-in/loyalty header, and a `/api/order/place` route earns a stamp per order.

**Tech Stack:** Next.js App Router (RSC + Route Handlers) on Cloudflare Workers (OpenNext), D1 (`DB`), KV (`APP_KV`), `getCloudflareContext()` from `@opennextjs/cloudflare`, plain CSS.

## Global Constraints

- No unit test runner exists in this repo (no `test` script, no `*.test.*`). Verification for every task = `npm run lint` (ESLint + Stylelint) + `npm run build` (must succeed) + `curl` against routes + browser checks. Do NOT invent a test framework or write fake unit tests.
- `npm run build`/wrangler need Node 22+: prefix build/wrangler commands with `export PATH="/Users/lamont/.nvm/versions/node/v22.16.0/bin:$PATH"`. `npm run lint` runs on the repo's default Node.
- Bindings: D1 is `env.DB`, KV is `env.APP_KV` (see `wrangler.jsonc`). Access only via `getCloudflareContext().env` inside a request (Route Handler or Server Component render) — never at module top level or build time.
- Cart line-item shape is exactly `{ id: string, name: string, unitPriceCents: number, qty: number }` (matches the current `OrderProvider`). Do not change it.
- `lib/cart.js` guest cookie is `CART_COOKIE = 'stacked_cart'`; the sign-in route (`app/api/auth/persona/route.js`) ALREADY calls `mergeGuestCartIntoUser` — do not add a second merge.
- Flags default OFF: an unknown/missing flag is `false`. `getFlags()` and `/api/cart` must degrade to safe defaults (flags off, empty cart) on any KV/D1 error — never 500 a page.
- `FLAGS_ADMIN_KEY` is a secret: `.dev.vars` for local dev (gitignored — verify it's in `.gitignore`), `wrangler secret put FLAGS_ADMIN_KEY` for prod. Never commit its value.
- `getMenuItem(slug)` reads the same `/menu/query-index.json` feed `getMenu()` uses (see `lib/catalog.js`) — no per-item HTML fetch.
- Loyalty is gated by `flags.loyalty` everywhere: header chip, earn-on-order write, and the menu sign-in prompt. Flag off = none of it shows or runs.
- Build order is fixed: SP1 (Tasks 1–3) before SP2 (Tasks 4–8). Within SP2: cart API → OrderProvider refactor → {menu item page, header, earn-on-order}.

---

## SP1 — Feature-flag system

### Task 1: `lib/flags.js` — runtime flag evaluation

**Files:**
- Create: `lib/flags.js`

**Interfaces:**
- Produces: `getFlags(): Promise<Record<string, boolean>>` and `isEnabled(name: string): Promise<boolean>`. The KV doc lives at key `flags` in `APP_KV` as a JSON object of `{ [name]: boolean }`. Cache tag is the literal string `'flags'` (Task 2 busts it).

- [ ] **Step 1: Write `lib/flags.js`**

```js
import { unstable_cache } from 'next/cache';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Feature flags: one JSON doc in APP_KV under key `flags` ({ loyalty: true, ... }). Written by
// POST /api/flags (admin-key gated), read here at runtime. Cached under the 'flags' tag so the
// write route's revalidateTag('flags') makes toggles take effect immediately. Unknown/missing
// flags default to false; any KV error degrades to {} (all off) — never throws.

export const FLAGS_KEY = 'flags';
export const FLAGS_TAG = 'flags';

async function readFlags() {
  try {
    const raw = await getCloudflareContext().env.APP_KV.get(FLAGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const cachedFlags = unstable_cache(readFlags, ['stacked-flags'], { tags: [FLAGS_TAG] });

/** @returns {Promise<Record<string, boolean>>} */
export async function getFlags() {
  return cachedFlags();
}

/** @param {string} name @returns {Promise<boolean>} */
export async function isEnabled(name) {
  return (await getFlags())[name] === true;
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Verify it evaluates in a request (temporary probe)**

Add a temporary line to `app/(site)/page.js` server component: `import { getFlags } from '../../lib/flags.js';` and `console.log('flags', await getFlags());` at the top of the component body. Start the dev server if not running (`npx -y @adobe/aem-cli up --no-open` is NOT this app — use the Browser-pane `next-eds-dev` preview or `npm run dev`), load `/`, confirm the server log prints `flags {}` (empty, since nothing's written yet) with no error. Then REMOVE the temporary lines.

- [ ] **Step 4: Commit**

```bash
git add lib/flags.js
git commit -m "feat(flags): runtime feature-flag evaluation from KV (getFlags/isEnabled)"
```

---

### Task 2: `/api/flags` route + `FLAGS_ADMIN_KEY`

**Files:**
- Create: `app/api/flags/route.js`
- Create: `.dev.vars` (gitignored — the local `FLAGS_ADMIN_KEY`)
- Modify: `.gitignore` (ensure `.dev.vars` is ignored, if not already)

**Interfaces:**
- Consumes: `FLAGS_KEY`, `FLAGS_TAG` from `lib/flags.js`.
- Produces: `GET /api/flags` → `200` JSON `{ [name]: boolean }` (public). `POST /api/flags` with header `Authorization: Bearer <FLAGS_ADMIN_KEY>` and JSON body `{ name: string, enabled: boolean }` → merges into the KV doc, `revalidateTag('flags')`, returns `200` JSON of the full flags; a bad/missing key → `401`; a malformed body → `400`.

- [ ] **Step 1: Ensure `.dev.vars` is gitignored, then create it**

Run: `grep -qxF '.dev.vars' .gitignore || echo '.dev.vars' >> .gitignore`
Create `.dev.vars` with a dev-only key:

```
FLAGS_ADMIN_KEY=dev-local-flags-key
```

Confirm `git status` does NOT list `.dev.vars`.

- [ ] **Step 2: Write `app/api/flags/route.js`**

```js
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { FLAGS_KEY, FLAGS_TAG } from '../../../lib/flags.js';

// Feature-flag admin API. GET is public (the DA app + app read current state). POST is gated by
// a bearer admin key (FLAGS_ADMIN_KEY secret) and flips one flag in the KV `flags` doc, then
// revalidates the 'flags' cache tag so getFlags() reflects it immediately.

function kv() {
  return getCloudflareContext().env.APP_KV;
}

async function readFlags() {
  const raw = await kv().get(FLAGS_KEY);
  if (!raw) return {};
  try { const p = JSON.parse(raw); return p && typeof p === 'object' ? p : {}; } catch { return {}; }
}

export async function GET() {
  return NextResponse.json(await readFlags());
}

export async function POST(request) {
  const auth = request.headers.get('authorization') || '';
  const key = getCloudflareContext().env.FLAGS_ADMIN_KEY;
  if (!key || auth !== `Bearer ${key}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch { body = null; }
  const name = body && typeof body.name === 'string' ? body.name : null;
  const enabled = body ? body.enabled === true : null;
  if (!name || enabled === null) {
    return NextResponse.json({ error: 'Expected { name: string, enabled: boolean }' }, { status: 400 });
  }

  const flags = await readFlags();
  flags[name] = enabled;
  await kv().put(FLAGS_KEY, JSON.stringify(flags));
  revalidateTag(FLAGS_TAG);
  return NextResponse.json(flags);
}
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint`
Run: `export PATH="/Users/lamont/.nvm/versions/node/v22.16.0/bin:$PATH" && npm run build`
Expected: lint clean; build succeeds and lists `ƒ /api/flags` as a dynamic route.

- [ ] **Step 4: Verify GET/POST against the dev server**

With the dev server running (`npm run dev`), run:

```bash
# public read — starts empty
curl -s http://localhost:3000/api/flags
# unauthorized write — 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/flags -H 'content-type: application/json' -d '{"name":"loyalty","enabled":true}'
# authorized write — returns {"loyalty":true}
curl -s -X POST http://localhost:3000/api/flags -H 'content-type: application/json' -H 'authorization: Bearer dev-local-flags-key' -d '{"name":"loyalty","enabled":true}'
# read again — reflects the write
curl -s http://localhost:3000/api/flags
```

Expected: first `{}`, second `401`, third `{"loyalty":true}`, fourth `{"loyalty":true}`.

- [ ] **Step 5: Commit**

```bash
git add app/api/flags/route.js .gitignore
git commit -m "feat(flags): GET/POST /api/flags admin API (bearer key + revalidateTag)"
```

---

### Task 3: DA flags app at `/flags-app.html`

**Files:**
- Create: `public/flags-app.html`

**Interfaces:**
- Consumes: `GET`/`POST /api/flags` (same-origin, since served from `/flags-app.html`).
- Produces: a static admin page (registered in DA manually) with a toggle per known flag and an admin-key field.

- [ ] **Step 1: Write `public/flags-app.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Stacked — Feature Flags</title>
  <style>
    body { font: 15px/1.5 system-ui, sans-serif; margin: 0; padding: 24px; color: #2a2520; background: #f3efe8; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    p { color: #6b6156; margin: 0 0 20px; }
    .key { display: block; width: 100%; max-width: 420px; padding: 10px 12px; margin-bottom: 20px; border: 1px solid rgba(60,45,25,0.16); border-radius: 8px; }
    .flag { display: flex; align-items: center; justify-content: space-between; max-width: 420px; padding: 14px 16px; margin-bottom: 10px; background: #fcfaf6; border: 1px solid rgba(60,45,25,0.1); border-radius: 10px; }
    .flag-name { font-weight: 600; }
    .status { font-size: 13px; color: #6b6156; }
    button { font: inherit; font-weight: 600; padding: 8px 16px; border: 0; border-radius: 8px; background: #ff7a00; color: #fff; cursor: pointer; }
    button[aria-pressed="false"] { background: #e9e3d8; color: #2a2520; }
    .msg { max-width: 420px; margin-top: 16px; font-size: 13px; color: #b4232f; min-height: 18px; }
  </style>
</head>
<body>
  <h1>Feature Flags</h1>
  <p>Toggle features for Stacked. Enter the admin key once; it's kept for this tab only.</p>
  <input class="key" id="key" type="password" placeholder="Admin key" autocomplete="off" />
  <div id="flags"></div>
  <div class="msg" id="msg" role="status" aria-live="polite"></div>
  <script>
    var KNOWN = ['loyalty'];
    var keyEl = document.getElementById('key');
    var msgEl = document.getElementById('msg');
    keyEl.value = sessionStorage.getItem('flagsKey') || '';
    keyEl.addEventListener('change', function () { sessionStorage.setItem('flagsKey', keyEl.value); });

    function render(state) {
      var box = document.getElementById('flags');
      box.innerHTML = '';
      KNOWN.forEach(function (name) {
        var on = state[name] === true;
        var row = document.createElement('div');
        row.className = 'flag';
        row.innerHTML = '<span><span class="flag-name">' + name + '</span><br><span class="status">' + (on ? 'On' : 'Off') + '</span></span>';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('aria-pressed', String(on));
        btn.textContent = on ? 'Turn off' : 'Turn on';
        btn.addEventListener('click', function () { toggle(name, !on); });
        row.appendChild(btn);
        box.appendChild(row);
      });
    }

    function load() {
      fetch('/api/flags').then(function (r) { return r.json(); }).then(render).catch(function () {
        msgEl.textContent = 'Could not load flags.';
      });
    }

    function toggle(name, enabled) {
      msgEl.textContent = '';
      fetch('/api/flags', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + keyEl.value },
        body: JSON.stringify({ name: name, enabled: enabled }),
      }).then(function (r) {
        if (r.status === 401) { msgEl.textContent = 'Wrong or missing admin key.'; return null; }
        return r.json();
      }).then(function (state) { if (state) render(state); }).catch(function () {
        msgEl.textContent = 'Update failed — try again.';
      });
    }

    load();
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify it serves and works**

With the dev server running, open `http://localhost:3000/flags-app.html` in the Browser pane. Enter `dev-local-flags-key`, toggle `loyalty` on/off, and confirm the status flips and `curl -s http://localhost:3000/api/flags` reflects it. Confirm a wrong key shows "Wrong or missing admin key."

- [ ] **Step 3: Commit**

```bash
git add public/flags-app.html
git commit -m "feat(flags): static DA flags app served at /flags-app.html"
```

- [ ] **Step 4: Hand off DA registration + prod secret (manual, not automated)**

These require the user (DA auth / Cloudflare). Surface them, don't attempt:
- Register the app in DA (app library) pointing at `https://nxtjs.page/flags-app.html`.
- `export PATH="/Users/lamont/.nvm/versions/node/v22.16.0/bin:$PATH" && npx wrangler secret put FLAGS_ADMIN_KEY` (prod value).

---

## SP2 — Authenticated ordering & loyalty

### Task 4: `/api/cart` route over the server/KV cart

**Files:**
- Create: `app/api/cart/route.js`

**Interfaces:**
- Consumes: `getCart`, `saveCart` from `lib/cart.js`; `getCurrentUser` from `lib/session.js`.
- Produces: `GET /api/cart` → `{ items: Item[] }`. `POST` body `{ name, unitPriceCents }` → adds/increments, returns `{ items }`. `PATCH` body `{ id, qty }` → sets qty (≤0 removes), returns `{ items }`. `DELETE` body `{ id }` → removes that id; `DELETE` with empty/absent body → clears; returns `{ items }`. `Item` is `{ id, name, unitPriceCents, qty }`. Cart identity: signed-in user (via `getCurrentUser`) else the guest cookie (created by `lib/cart.js`).

- [ ] **Step 1: Write `app/api/cart/route.js`**

```js
import { NextResponse } from 'next/server';
import { getCart, saveCart } from '../../../lib/cart.js';
import { getCurrentUser } from '../../../lib/session.js';

// Server/KV cart mutation surface (see lib/cart.js). Resolves identity from the session
// (signed-in user) or the guest cart cookie. Degrades to an empty cart on error — never 500s.

async function currentCart() {
  const user = await getCurrentUser();
  const items = await getCart(user);
  return { user, items: Array.isArray(items) ? items : [] };
}

export async function GET() {
  try {
    const { items } = await currentCart();
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request) {
  const { user, items } = await currentCart();
  const body = await request.json().catch(() => null);
  const name = body && typeof body.name === 'string' ? body.name : null;
  const unitPriceCents = body && Number.isFinite(body.unitPriceCents) ? body.unitPriceCents : null;
  if (!name || unitPriceCents === null) {
    return NextResponse.json({ error: 'Expected { name, unitPriceCents }' }, { status: 400 });
  }
  const idx = items.findIndex((i) => i.name === name && i.unitPriceCents === unitPriceCents);
  if (idx >= 0) {
    items[idx] = { ...items[idx], qty: items[idx].qty + 1 };
  } else {
    items.push({ id: `${Date.now()}-${items.length}`, name, unitPriceCents, qty: 1 });
  }
  await saveCart(user, items);
  return NextResponse.json({ items });
}

export async function PATCH(request) {
  const { user, items } = await currentCart();
  const body = await request.json().catch(() => null);
  const id = body && typeof body.id === 'string' ? body.id : null;
  const qty = body && Number.isFinite(body.qty) ? body.qty : null;
  if (!id || qty === null) {
    return NextResponse.json({ error: 'Expected { id, qty }' }, { status: 400 });
  }
  const next = qty <= 0
    ? items.filter((i) => i.id !== id)
    : items.map((i) => (i.id === id ? { ...i, qty } : i));
  await saveCart(user, next);
  return NextResponse.json({ items: next });
}

export async function DELETE(request) {
  const { user, items } = await currentCart();
  const body = await request.json().catch(() => null);
  const id = body && typeof body.id === 'string' ? body.id : null;
  const next = id ? items.filter((i) => i.id !== id) : [];
  await saveCart(user, next);
  return NextResponse.json({ items: next });
}
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint`
Run: `export PATH="/Users/lamont/.nvm/versions/node/v22.16.0/bin:$PATH" && npm run build`
Expected: lint clean; build lists `ƒ /api/cart`.

- [ ] **Step 3: Verify against the dev server (guest cart, cookie jar)**

```bash
curl -s -c /tmp/cj -b /tmp/cj http://localhost:3000/api/cart
curl -s -c /tmp/cj -b /tmp/cj -X POST http://localhost:3000/api/cart -H 'content-type: application/json' -d '{"name":"Italian Stack","unitPriceCents":1100}'
curl -s -c /tmp/cj -b /tmp/cj -X POST http://localhost:3000/api/cart -H 'content-type: application/json' -d '{"name":"Italian Stack","unitPriceCents":1100}'
curl -s -c /tmp/cj -b /tmp/cj http://localhost:3000/api/cart
```

Expected: empty `{"items":[]}`, then a 1-qty item, then qty 2 (same id), then the final GET shows qty 2. (Requires local KV; if the dev server's APP_KV isn't available it returns `{"items":[]}` — note that and rely on the browser check in Task 5.)

- [ ] **Step 4: Commit**

```bash
git add app/api/cart/route.js
git commit -m "feat(cart): /api/cart GET/POST/PATCH/DELETE over the server/KV cart"
```

---

### Task 5: Refactor `OrderProvider` to a server-backed client cache

**Files:**
- Modify: `lib/order/OrderProvider.jsx`

**Interfaces:**
- Consumes: `/api/cart` (Task 4).
- Produces: the SAME `useOrder()` shape as today — `{ items, orderCount, orderTotalCents, pickupTime, hydrated, addToOrder({name, unitPriceCents}), setQty(id, qty), remove(id), clear(), setPickupTime }` — so `AppShell`, `OrderView`, the builder, and menu pages need no consumer changes. `pickupTime` stays ephemeral client state (not server-persisted). `hydrated` flips true after the initial `GET /api/cart`.

- [ ] **Step 1: Rewrite `lib/order/OrderProvider.jsx`**

```jsx
'use client';

import {
  createContext, useContext, useEffect, useMemo, useState, useCallback,
} from 'react';

// Order store backed by the server/KV cart (/api/cart). Keeps the same useOrder() shape it had
// as a localStorage store, so every consumer is unchanged. Mutations POST/PATCH/DELETE and set
// the returned items (server is source of truth). pickupTime is ephemeral client state.

const OrderContext = createContext(null);

async function cartFetch(method, body) {
  const res = await fetch('/api/cart', {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error('cart request failed');
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export function OrderProvider({ children }) {
  const [items, setItems] = useState([]);
  const [pickupTime, setPickupTime] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/cart')
      .then((r) => r.json())
      .then((d) => { if (live) setItems(Array.isArray(d.items) ? d.items : []); })
      .catch(() => { /* keep empty */ })
      .finally(() => { if (live) setHydrated(true); });
    return () => { live = false; };
  }, []);

  const addToOrder = useCallback(({ name, unitPriceCents }) => {
    setItems((prev) => {
      // optimistic: mirror the server's add/increment
      const idx = prev.findIndex((i) => i.name === name && i.unitPriceCents === unitPriceCents);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { id: `tmp-${Date.now()}`, name, unitPriceCents, qty: 1 }];
    });
    cartFetch('POST', { name, unitPriceCents }).then(setItems).catch(() => {});
  }, []);

  const setQty = useCallback((id, qty) => {
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.id !== id)
      : prev.map((i) => (i.id === id ? { ...i, qty } : i))));
    cartFetch('PATCH', { id, qty }).then(setItems).catch(() => {});
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    cartFetch('DELETE', { id }).then(setItems).catch(() => {});
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    cartFetch('DELETE', null).then(setItems).catch(() => {});
  }, []);

  const value = useMemo(() => ({
    items,
    orderCount: items.reduce((s, i) => s + i.qty, 0),
    orderTotalCents: items.reduce((s, i) => s + i.unitPriceCents * i.qty, 0),
    pickupTime,
    hydrated,
    addToOrder,
    setQty,
    remove,
    clear,
    setPickupTime,
  }), [items, pickupTime, hydrated, addToOrder, setQty, remove, clear]);

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrder must be used within an OrderProvider');
  return ctx;
}
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint`
Run: `export PATH="/Users/lamont/.nvm/versions/node/v22.16.0/bin:$PATH" && npm run build`
Expected: clean + successful.

- [ ] **Step 3: Browser verify the cart round-trips**

Dev server running. In the Browser pane: go to `/build`, add an ingredient/stack (or `/menu` → a card → add), confirm the tab-bar order badge increments; reload the page and confirm the badge/count PERSISTS (proves server-backed, not localStorage). Go to `/order`, change qty and remove — confirm it updates. Check `read_console_messages` for errors (none expected). Note: this needs the dev server's local KV; if unavailable, the count won't persist across reload — report that rather than treating the code as wrong.

- [ ] **Step 4: Commit**

```bash
git add lib/order/OrderProvider.jsx
git commit -m "refactor(order): back OrderProvider with the server/KV cart via /api/cart"
```

---

### Task 6: Menu item pages (`/menu/[slug]`) with add-to-order

**Files:**
- Modify: `lib/catalog.js` (add `getMenuItem`)
- Create: `app/(site)/menu/[slug]/page.js`
- Create: `app/(site)/menu/[slug]/MenuItemDetail.jsx`
- Create: `app/(site)/menu/[slug]/menu-item.css`

**Interfaces:**
- Consumes: `getMenu` machinery in `lib/catalog.js`; `useOrder().addToOrder` (Task 5); `getFlags` (Task 1); `getCurrentUser` (`lib/session.js`).
- Produces: `getMenuItem(slug): Promise<MenuItem|null>` (same `MenuItem` shape `getMenu` returns). A page at `/menu/<slug>` rendering the item + an add-to-order button; a missing slug → `notFound()`.

- [ ] **Step 1: Add `getMenuItem` to `lib/catalog.js`**

Append this exported function (it reuses `getMenu`, which already reads `/menu/query-index.json`):

```js
/**
 * Fetch one menu item by slug from the same query-index feed getMenu() uses.
 * @param {string} slug
 * @returns {Promise<MenuItem|null>}
 */
export async function getMenuItem(slug) {
  if (!slug) return null;
  const items = await getMenu();
  return items.find((i) => i.slug === slug) ?? null;
}
```

- [ ] **Step 2: Create `MenuItemDetail.jsx` (client — the add button)**

```jsx
'use client';

import { useOrder } from '../../../../lib/order/OrderProvider.jsx';

export default function MenuItemDetail({ item, showSignInPrompt }) {
  const { addToOrder } = useOrder();
  return (
    <div className="menu-item-actions">
      <button
        type="button"
        className="btn btn-primary menu-item-add"
        onClick={() => addToOrder({ name: item.name, unitPriceCents: item.priceCents })}
      >
        {`Add to order · $${(item.priceCents / 100).toFixed(2)}`}
      </button>
      {showSignInPrompt && (
        <p className="menu-item-signin">
          <a href="/signin">Sign in</a>
          {' to save your usual and earn stamps.'}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `page.js`**

```jsx
import { notFound } from 'next/navigation';
import { getMenuItem } from '../../../../lib/catalog.js';
import { getCurrentUser } from '../../../../lib/session.js';
import { getFlags } from '../../../../lib/flags.js';
import MenuItemDetail from './MenuItemDetail.jsx';
import './menu-item.css';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const item = await getMenuItem(slug);
  return { title: item ? `${item.name} — Stacked` : 'Menu — Stacked' };
}

export default async function MenuItemPage({ params }) {
  const { slug } = await params;
  const [item, user, flags] = await Promise.all([getMenuItem(slug), getCurrentUser(), getFlags()]);
  if (!item) notFound();

  return (
    <main className="menu-item">
      <div className="menu-item-inner">
        <div className="menu-item-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt={item.name} />
          {item.special && <span className="menu-item-badge">Special</span>}
        </div>
        <div className="menu-item-body">
          <h1 className="menu-item-name">{item.name}</h1>
          <p className="menu-item-desc">{item.description}</p>
          <MenuItemDetail item={item} showSignInPrompt={!user && flags.loyalty} />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create `menu-item.css`**

```css
.menu-item-inner {
  max-width: var(--shell-max, 1160px);
  margin: 0 auto;
  padding: 24px;
  display: grid;
  gap: 24px;
}

.menu-item-media {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--surface);
  border-radius: 16px;
  overflow: hidden;
}

.menu-item-media img { width: 100%; height: 100%; object-fit: cover; }

.menu-item-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
}

.menu-item-name {
  margin: 0 0 8px;
  font-family: var(--font-content);
  font-style: italic;
  font-weight: 600;
}

.menu-item-desc { margin: 0 0 20px; color: var(--text-secondary); }

.menu-item-signin { margin: 12px 0 0; font-size: 13px; color: var(--text-secondary); }

.site-footer ~ * .menu-item-add,
.menu-item-add { min-height: 48px; }

@media (width >= 900px) {
  .menu-item-inner { grid-template-columns: 1fr 1fr; align-items: center; }
}
```

- [ ] **Step 5: Lint + build**

Run: `npm run lint`
Run: `export PATH="/Users/lamont/.nvm/versions/node/v22.16.0/bin:$PATH" && npm run build`
Expected: clean; build lists the `/menu/[slug]` route.

- [ ] **Step 6: Browser verify**

Dev server running. Visit `/menu` → click a card → lands on `/menu/<slug>` showing image, name, description, and an "Add to order · $X.XX" button. Click it → the tab order badge increments. Signed out with `loyalty` flag on, the sign-in prompt shows; toggle `loyalty` off (via `/flags-app.html`) and reload → the prompt is gone. Visit `/menu/does-not-exist` → 404.

- [ ] **Step 7: Commit**

```bash
git add lib/catalog.js "app/(site)/menu/[slug]"
git commit -m "feat(menu): item detail pages with add-to-order and flag-gated sign-in prompt"
```

---

### Task 7: Signed-in state + loyalty chip in the header

**Files:**
- Modify: `app/(site)/layout.js`
- Modify: `app/(site)/AppShell.jsx`
- Modify: `app/(site)/shell.css`

**Interfaces:**
- Consumes: `getCurrentUser` (`lib/session.js`), `getFlags` (Task 1).
- Produces: `AppShell` receives `user` (`{ id, name, avatar_initials, loyalty_stamps } | null`) and `flags` (`{ [name]: boolean }`) props and renders: signed-out → the existing "Sign in" link; signed-in → avatar initials + first name + a sign-out control (posts to `/api/auth/signout`); plus a loyalty chip (`★ <n>`) when `user && flags.loyalty`.

- [ ] **Step 1: Feed user + flags from the layout**

In `app/(site)/layout.js`, add imports and include both in the existing async fetch, then pass to `AppShell`:

```js
import { getCurrentUser } from '../../lib/session.js';
import { getFlags } from '../../lib/flags.js';
```

Replace the footer-only fetch with a combined one and pass the new props (keep the existing providers):

```js
const [footerModel, user, flags] = await Promise.all([
  getFooter().then(parseFooter),
  getCurrentUser(),
  getFlags(),
]);
// ...
<AppShell footerModel={footerModel} user={user} flags={flags}>{children}</AppShell>
```

(If `getFooter().then(parseFooter)` doesn't match the current call shape, keep the current footer call and just add `getCurrentUser()` and `getFlags()` to the `Promise.all`.)

- [ ] **Step 2: Render signed-in state in `AppShell.jsx`**

Accept the new props: `export default function AppShell({ children, footerModel, user, flags }) {`. Find the header's "Sign in" element (the tools/right side of the top bar) and replace it with:

```jsx
{user ? (
  <div className="shell-account">
    {flags?.loyalty && (
      <span className="shell-loyalty" title={`${user.loyalty_stamps} loyalty stamps`}>
        {`★ ${user.loyalty_stamps}`}
      </span>
    )}
    <span className="shell-avatar" aria-hidden="true">{user.avatar_initials}</span>
    <span className="shell-user-name">{user.name.split(' ')[0]}</span>
    <form action="/api/auth/signout" method="POST" className="shell-signout-form">
      <button type="submit" className="shell-signout">Sign out</button>
    </form>
  </div>
) : (
  <a className="shell-signin" href="/signin">Sign in</a>
)}
```

Keep the existing `.shell-signin` class/markup for the signed-out link (match whatever the current class is named — reuse it, don't rename).

- [ ] **Step 3: Style the account cluster in `shell.css`**

```css
.shell-account {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.shell-loyalty {
  font-family: var(--font-chrome);
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
}

.shell-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: var(--primary);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.shell-user-name { font-family: var(--font-chrome); font-weight: 600; font-size: 14px; }

.shell-signout-form { margin: 0; }

.shell-signout {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}
```

- [ ] **Step 4: Lint + build**

Run: `npm run lint`
Run: `export PATH="/Users/lamont/.nvm/versions/node/v22.16.0/bin:$PATH" && npm run build`
Expected: clean + successful (build lists `/` and others; the layout is async — fine).

- [ ] **Step 5: Browser verify**

Dev server running (needs local D1 migrated for personas — if `/signin` errors with "no such table", run `export PATH="/Users/lamont/.nvm/versions/node/v22.16.0/bin:$PATH" && npx wrangler d1 migrations apply stacked-db` for the local DB, then restart the dev server). Signed out: header shows "Sign in". Sign in via `/signin` (pick a persona): header shows avatar initials + first name + Sign out, and — with `loyalty` on — a `★ N` chip. Toggle `loyalty` off via `/flags-app.html`, reload: the chip disappears but the signed-in name/sign-out remain. Sign out: header returns to "Sign in".

- [ ] **Step 6: Commit**

```bash
git add "app/(site)/layout.js" "app/(site)/AppShell.jsx" "app/(site)/shell.css"
git commit -m "feat(header): signed-in state + flag-gated loyalty stamp chip"
```

---

### Task 8: Earn a loyalty stamp per placed order

**Files:**
- Create: `app/api/order/place/route.js`
- Modify: `app/(site)/order/OrderView.jsx`

**Interfaces:**
- Consumes: `getCurrentUser` (`lib/session.js`), `getFlags` (Task 1), `getDb` (`lib/db.js`), `getCart`/`saveCart` (`lib/cart.js`).
- Produces: `POST /api/order/place` body `{ pickupTime?: string }` → returns `{ ok: true, totalCents, pickupTime, stampEarned: boolean }`; when signed in AND `flags.loyalty`, increments `users.loyalty_stamps` (+1) and records the order in `orders`/`order_items`; always clears the cart.

- [ ] **Step 1: Write `app/api/order/place/route.js`**

```js
import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/session.js';
import { getFlags } from '../../../../lib/flags.js';
import { getDb } from '../../../../lib/db.js';
import { getCart, saveCart } from '../../../../lib/cart.js';

// Simulated order placement. Clears the cart; when signed in and the loyalty flag is on, earns
// one stamp and records the order. Never 500s the client — a persistence error still clears the
// cart and returns ok with stampEarned:false.
export async function POST(request) {
  const user = await getCurrentUser();
  const body = await request.json().catch(() => ({}));
  const pickupTime = body && typeof body.pickupTime === 'string' ? body.pickupTime : '';

  const items = await getCart(user);
  const totalCents = (Array.isArray(items) ? items : [])
    .reduce((s, i) => s + i.unitPriceCents * i.qty, 0);

  let stampEarned = false;
  const flags = await getFlags();
  if (user && flags.loyalty) {
    try {
      const db = getDb();
      await db.prepare('UPDATE users SET loyalty_stamps = loyalty_stamps + 1 WHERE id = ?')
        .bind(user.id).run();
      const orderId = crypto.randomUUID();
      await db.prepare('INSERT INTO orders (id, user_id, total_cents, pickup_time) VALUES (?, ?, ?, ?)')
        .bind(orderId, user.id, totalCents, pickupTime).run();
      stampEarned = true;
    } catch {
      stampEarned = false;
    }
  }

  await saveCart(user, []);
  return NextResponse.json({
    ok: true, totalCents, pickupTime, stampEarned,
  });
}
```

Note: confirm the `orders` columns against `migrations/0001_schema.sql` before running — if the column names differ (e.g. `total`, `pickup`), match them exactly, or drop the `INSERT` (keep only the stamp increment + clear) if the schema doesn't have a compatible `orders` shape. The stamp increment and cart clear are the required behavior; the order-row insert is best-effort.

- [ ] **Step 2: Wire `OrderView.placeOrder` to the route**

In `app/(site)/order/OrderView.jsx`, make `placeOrder` async and call the route before clearing:

```jsx
const placeOrder = async () => {
  const total = orderTotalCents;
  try {
    await fetch('/api/order/place', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pickupTime }),
    });
  } catch {
    // simulated placement still succeeds for the demo
  }
  setPlaced({ total, pickupTime });
  clear();
};
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint`
Run: `export PATH="/Users/lamont/.nvm/versions/node/v22.16.0/bin:$PATH" && npm run build`
Expected: clean; build lists `ƒ /api/order/place`.

- [ ] **Step 4: Browser verify earn-on-order**

Dev server + local D1 migrated. Sign in (persona Alex, `loyalty` on). Note the header chip count (e.g. `★ 7`). Add an item, go to `/order`, Place order → confirmation shows. Return home / reload → header chip is `★ 8`. Toggle `loyalty` off, place another order → chip stays hidden and does not increment (verify via `/flags-app.html` on + reload that the count didn't move). Signed out: placing an order still works (confirmation) with no stamp.

- [ ] **Step 5: Commit**

```bash
git add app/api/order/place/route.js "app/(site)/order/OrderView.jsx"
git commit -m "feat(loyalty): earn a stamp per placed order, gated by flags.loyalty"
```

---

## Final verification + PR

- [ ] `npm run lint` clean; `export PATH="/Users/lamont/.nvm/versions/node/v22.16.0/bin:$PATH" && npm run build` succeeds.
- [ ] Full walkthrough: toggle `loyalty` off/on at `/flags-app.html` and confirm the header chip, menu sign-in prompt, and earn-on-order all follow the flag; cart persists across reloads (server-backed); menu item pages add to cart; sign-in shows account state.
- [ ] Open a PR whose body includes the `https://<branch>--next-eds--AdobeDevXSC.aem.page/` test URL (per AGENTS.md — the `aem-psi-check` rejects PRs without a test URL). Note the manual follow-ups: register the DA flags app pointing at `nxtjs.page/flags-app.html`, and set the prod `FLAGS_ADMIN_KEY` secret.
