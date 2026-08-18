# Feature flags (DA-controlled) + authenticated ordering & loyalty

Two related sub-projects on the post-redesign `main`:

- **SP1 — Feature-flag system:** a DA app toggles flags; a Cloudflare Worker route writes them to
  KV; the app reads them at runtime and gates features. First gated feature: loyalty.
- **SP2 — Authenticated ordering & loyalty:** menu item detail pages with add-to-cart, a unified
  server/KV cart, signed-in state + loyalty stamps in the header, and earn-on-order — all loyalty
  UI gated by SP1's flag.

Build order: **SP1 first** (infra), then SP2 (consumes `flags.loyalty`).

## Approved decisions (2026-08-17)

1. Flags flow **DA app → `POST /api/flags` (Worker) → KV**, read at runtime (cached). No redeploy.
2. `/api/flags` writes are protected by a **shared admin key** (a Worker secret). Reads are public.
3. Cart is the **server/KV cart** (`lib/cart.js`) — the redesign's client localStorage order store
   is refactored to be server-backed (one authoritative cart, guest→user merge).
4. Loyalty **earns +1 stamp per placed order** (`users.loyalty_stamps` in D1), shown in the header,
   gated by `flags.loyalty`.

---

## SP1 — Feature-flag system

### Store
One KV key in `APP_KV`: `flags` → a JSON object, e.g. `{ "loyalty": true }`. A single read
evaluates every flag. Unknown/missing flags default to `false` (off = safe).

### Endpoints (`app/api/flags/route.js`)
- **`GET /api/flags`** — public. Returns the current flags JSON. Used by the DA app to render
  toggle states and (optionally) by the client.
- **`POST /api/flags`** — body `{ "name": string, "enabled": boolean }`. Requires
  `Authorization: Bearer <FLAGS_ADMIN_KEY>`; a mismatch → `401`. Merges the change into the KV
  `flags` doc, then `revalidateTag('flags')` so runtime reads refresh immediately. Returns the new
  flags JSON.
- `FLAGS_ADMIN_KEY` is a Worker secret (`wrangler secret put FLAGS_ADMIN_KEY`); in local dev it
  comes from `.dev.vars`. Never committed.
- **Same-origin:** the DA app is served from the app's own origin (see below), so calls to
  `/api/flags` are same-origin — no CORS handling needed.

### Runtime evaluation (`lib/flags.js`)
`getFlags(): Promise<Record<string, boolean>>` reads the KV `flags` doc inside a request, wrapped in
Next's data cache tagged `'flags'` (so the `POST` handler's `revalidateTag('flags')` busts it).
Returns a plain object with a safe default of `{}` on any error (features fall back to off). A
convenience `isEnabled(name)` returns `getFlags()[name] === true`.

### DA app (served at `/flags-app`, registered in DA)
A single static HTML app (no build), served from the app's own origin at `/flags-app` (e.g.
`public/flags-app.html` → `nxtjs.page/flags-app.html`). Because it shares the app origin, its calls
to `/api/flags` are same-origin. It:
- `GET`s `/api/flags` on load and renders one labeled toggle switch per known flag (seed list:
  `loyalty`), reflecting current state.
- On toggle, `POST`s `{ name, enabled }` to `/api/flags` with the admin key in the
  `Authorization` header. The admin key is entered once in the app and kept in `sessionStorage`
  (never hard-coded).
- Registered in DA as a custom app pointing at `nxtjs.page/flags-app.html` — a manual DA-admin step
  (needs DA auth), surfaced to the user rather than automated here. It appears inside DA's UI but is
  hosted by us, keeping API calls same-origin.

### Gating
`flags.loyalty` wraps every loyalty surface (header chip, earn-on-order, any loyalty copy). Off =
the feature is fully absent (not just visually hidden where it matters for correctness — the
earn-on-order write is also skipped).

---

## SP2 — Authenticated ordering & loyalty

### Unified server/KV cart (refactor)
Replace the redesign's client `OrderProvider` (localStorage) with a server-backed cart:

- `lib/cart.js` (exists) stores items in KV, namespaced `cart:user:<id>` / `cart:guest:<id>`, with
  `mergeGuestCartIntoUser(userId)` on sign-in. Guest identity is the existing `CART_COOKIE`
  (`'stacked_cart'`, uuid, created on first cart write in a Route Handler; httpOnly). Cart line
  items keep the current shape `{ id, name, unitPriceCents, qty }` so `useOrder` consumers are
  unchanged.
- **`app/api/cart/route.js`** — `GET` returns the current cart (user cart if signed in, else guest
  cart); `POST` `{ name, unitPriceCents, qty? }` adds/increments; `PATCH` `{ id, qty }` sets qty
  (0 removes); `DELETE` `{ id }` removes; `DELETE` with no body clears. All resolve the cart key
  from session (`getCurrentUser`) or the guest cookie.
- `OrderProvider` becomes a thin **client cache**: it `GET`s `/api/cart` on mount, exposes
  `addToOrder`/`setQty`/`remove`/`clear` that call the API and update local state optimistically,
  and drops the localStorage logic. Same public hook shape (`useOrder`) so `AppShell` (tab badge),
  the order view, the builder, and menu pages consume it unchanged where possible.
- On sign-in (`/api/auth/persona`), call `mergeGuestCartIntoUser` so a guest's cart follows them.

### Menu item pages (`app/(site)/menu/[slug]/page.js`)
Explicit route (wins over the EDS `[...slug]` catch-all). Renders a bespoke item detail in the
redesign's language: the item's brick illustration / image, name, price, Special badge,
description, tags, and an **"Add to order"** button (posts to `/api/cart`). When signed out, a
subtle "Sign in to save your usual and earn stamps" prompt (only shown when `flags.loyalty` is on).
Data via a new `getMenuItem(slug)` in `lib/catalog.js` (reads the same source as `getMenu`). A
missing/invalid slug → `notFound()`.

### Signed-in state + loyalty header
`app/(site)/layout.js` (server) fetches `getCurrentUser()` and `getFlags()` and passes
`{ user, flags }` to `AppShell`:
- **Signed out:** the existing "Sign in" pill (→ `/signin`).
- **Signed in:** replace the pill with the user's avatar initials + first name and a sign-out
  control (posts to `/api/auth/signout`).
- **Loyalty chip:** when `user` and `flags.loyalty`, show a stamp chip (e.g. `★ 7`) in the header,
  reading `user.loyalty_stamps`. Flag off → no chip, regardless of sign-in.

### Loyalty earning
Placing an order (order view "Place order") calls a route/action that, when signed in **and**
`flags.loyalty`: increments `users.loyalty_stamps` (+1) in D1, records the order (existing
`orders`/`order_items` tables), and clears the cart. Signed out or flag off → the order still
"places" (demo) and clears the cart, but no stamp is written.

---

## Data flow (end to end)

```
DA app toggle ──POST /api/flags {loyalty:false} (Bearer key)──▶ Worker
   Worker: KV flags.loyalty=false ; revalidateTag('flags')
App render ──getFlags() (KV, cached, tag 'flags')──▶ { loyalty:false }
   → header loyalty chip hidden ; earn-on-order skipped ; menu sign-in-prompt hidden
```

## Error handling
- `getFlags()` and the cart API degrade to safe defaults (flags off, empty cart) on KV/network
  error — never 500 a page over flag/cart infra.
- `POST /api/flags` without a valid key → `401`, no state change.
- Cart operations are idempotent per item id; a failed optimistic client update re-syncs from `GET`.

## Testing / validation
1. `POST /api/flags` with the key flips KV; `GET /api/flags` reflects it; `getFlags()` in a page
   reflects it after `revalidateTag`.
2. DA app renders current flags and toggles them (manual, against the deployed Worker).
3. Menu item page renders and "Add to order" adds to the server cart (guest + signed-in).
4. Header shows signed-in state; loyalty chip appears only when signed in **and** flag on.
5. Place an order signed-in with flag on → `loyalty_stamps` +1; with flag off → no increment.
6. Guest cart merges into the user cart on sign-in.
7. `npm run build` + `npm run lint` clean.

## Non-goals
- No general admin panel — just the flags DA app.
- No flags beyond `loyalty` initially (the store supports arbitrary flags; adding one is data-only).
- No real payment/fulfillment — "Place order" stays simulated.

## Known deviations / notes to confirm during build
- The DA app **registration** in DA (adding it to the app library, pointing at
  `nxtjs.page/flags-app.html`) is a manual DA-admin step (needs DA auth) — surfaced to the user,
  not automated. Because the app is served from our origin, its `/api/flags` calls are same-origin
  (no CORS).
- Refactoring `OrderProvider` to server-backed changes offline behavior: the cart now needs the
  network (the PWA's offline story for the cart is reduced vs the localStorage store). Acceptable
  for the demo; noted.
