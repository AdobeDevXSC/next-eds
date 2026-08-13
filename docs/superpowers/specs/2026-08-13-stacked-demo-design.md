# Stacked — demo design spec

Date: 2026-08-13
Status: proposed (brainstorming output; awaiting review before planning)
Related: [PRODUCT.md](../../PRODUCT.md) · [DESIGN.md](../../DESIGN.md) (Brick Stack design system) · [content-schema.md](../../content-schema.md) (catalog schema)

## 1. Thesis

Convert the `next-eds` spike into **Stacked**, a fictional lunch sandwich shop, as a capability demo for AEM Edge Delivery Services + Next.js. The one idea the demo proves: **one site, one Cloudflare deploy, where non-developers own the menu in EDS and developers own a logged-in, persistent ordering app — blended on the same pages.** Authentication, persistence, personalization, and an installable PWA are the proof points.

## 2. Goals / non-goals

**Goals**
- Author-managed catalog: the menu *and* the build-your-own ingredient palette (with prices) are authored in EDS as **structured content** and drive the app; editing a menu item or an ingredient and publishing updates both the menu and the builder at the edge.
- A real ordering app: shop the menu, build a custom sandwich with a live price, cart, and a **simulated** checkout (no payment).
- Accounts with persistence: one-click demo personas, saved sandwiches / "my usual," order history with one-tap reorder, and loyalty.
- Installable PWA, themed to the brand.
- Everything expressed in the **Brick Stack** design system.

**Non-goals (explicitly out of scope)**
- Real payments (no Stripe, no card handling).
- Real email or OAuth sign-up (personas + sessions only).
- Real inventory, kitchen ops, or fulfillment.
- An admin UI — EDS *is* the admin for content; there is no custom CMS.
- Spreadsheet/JSON data feeds for the catalog — the catalog is structured content (see §4.1).

## 3. Architecture overview

Keep the existing pipeline: EDS is the headless content source; Next.js App Router + RSC renders on Cloudflare Workers (OpenNext); R2/KV back the ISR/tag cache; `/api/revalidate` fires on publish.

Add two planes on top:
- **Authored content plane (EDS):** marketing/content pages (rendered by the existing catch-all) plus a **structured-content catalog** — menu items as indexed pages under `/menu/*` (→ `/menu/query-index.json`) and the build-your-own palette as an `Ingredients` block on `/config/ingredients`. Schema in [content-schema.md](../../content-schema.md). No spreadsheets.
- **App plane (Next.js on the edge):** explicit app routes for the ordering experience, backed by Cloudflare **D1** (SQL) for user/transactional data and **KV** for sessions and carts.

```
Author (Docs/DA) ──► EDS .live ──► marketing pages (.plain.html)          ─┐
                               ├─► /menu/* pages → /menu/query-index.json  ─┤ read at edge (ISR + on-publish revalidate)
                               └─► /config/ingredients (Ingredients block) ─┘
                                                                    ▼
                       Next.js App Router + RSC on Cloudflare Workers (OpenNext)
                         • catch-all [[...slug]]  → EDS marketing/content (+ optional /menu/<slug> detail)
                         • explicit routes        → /menu /build /cart /account /order /signin + /api/*
                                 │                         │
                                 ▼                         ▼
                          D1 (users, saved,           KV (sessions, carts;
                          orders, order_items,         + existing OpenNext
                          loyalty)                      tag cache)
```

### 3.1 Routing & route precedence
- The existing optional catch-all `app/(site)/[[...slug]]/page.js` continues to serve EDS content (home `/`, `/story`, `/locations`, `/catering`, and optionally `/menu/<slug>` item detail pages).
- New **explicit** app routes take precedence over the catch-all in the App Router: `/menu`, `/build`, `/cart`, `/account`, `/order/[id]`, `/signin`, and `/api/*`.
- Decision: **`/menu` is an app route**, not EDS content — it reads the menu query-index (`/menu/query-index.json`) and layers personalization (RSC). Individual `/menu/<slug>` items are authored pages (indexed, and optionally viewable as detail pages via the catch-all). Marketing pages stay EDS-authored; the home page may embed a server-rendered menu highlight reading the same feed.
- The catch-all keeps its `notFound()` guard so non-existent EDS paths 404 rather than 500.

### 3.2 New / changed modules
- `lib/catalog.js` — `getMenu()` reads `/menu/query-index.json` (generalizing `lib/eds/queryIndex.js` to accept a feed path) and coerces/validates rows into `MenuItem[]`; `getIngredients()` fetches `/config/ingredients.plain.html` and parses the `Ingredients` block into a grouped palette. Both cached with ISR + a `catalog` revalidation tag. Field definitions and validation rules in [content-schema.md](../../content-schema.md).
- `lib/db.js` — D1 access via `getCloudflareContext().env.DB`; typed query helpers.
- `lib/session.js` — session cookie (httpOnly, SameSite=Lax) ↔ KV lookup; `getCurrentUser()`.
- `lib/cart.js` — cart in KV keyed by session (guest) or user; guest→user merge on sign-in.
- `middleware.js` — extend the existing www→apex redirect to also guard `/account` and the checkout step (redirect to `/signin` when no session cookie; full validation happens in the route).
- `lib/registry.js` — add any new EDS blocks used by marketing pages (e.g. a `menu-highlight` autoblock) if needed.

## 4. Data model

### 4.1 Authored catalog (EDS structured content — see [content-schema.md](../../content-schema.md))
- **Menu items = indexed content pages.** One page per sandwich under `/menu/<slug>`; structured fields (`price`, `category`, `tags`, `special`) live in the page Metadata and are indexed via `helix-query.yaml` into a scoped `/menu/query-index.json`. Each item is a real content page (own URL, image, description, optional detail view).
- **Ingredients = a structured block.** A single `/config/ingredients` page holds one `Ingredients` block (a table: `type`, `name`, `price`, `default`). `bread` prices are the build base; other types are additive upcharges. `type` also drives single- vs multi-select in the builder.
- Prices live in content. Orders capture a **price/build snapshot** at order time, so later edits don't rewrite history.

### 4.2 D1 (SQL) — user & transactional
```
users(id TEXT PK, name, email, avatar_initials, is_demo INT, loyalty_stamps INT, created_at)
saved_sandwiches(id TEXT PK, user_id FK, name, build_json TEXT, created_at)
orders(id TEXT PK, user_id FK, status TEXT, pickup_time TEXT, subtotal_cents INT, created_at)
order_items(id TEXT PK, order_id FK, kind TEXT[menu|custom], label TEXT, unit_price_cents INT, qty INT, build_json TEXT NULL)
```
- Loyalty is a `loyalty_stamps` counter on `users`; a completed order increments it; reaching 9 grants a free-sandwich reward and resets. Kept simple for the demo.

### 4.3 KV
- `session:<id>` → `{ userId, expiresAt }`.
- `cart:<sessionId|userId>` → `[{ kind, refSlug|label, build, unitPriceCents, qty }]`.
- (Existing `NEXT_TAG_CACHE_KV` stays for OpenNext.)

### 4.4 Seed data (personas)
A D1 seed inserts demo personas so a one-click sign-in lands on a lived-in account:
- **Alex Rivera** — regular: a saved "usual" (The Italian Stack), 3 past orders, 7 loyalty stamps.
- **Jordan Lee** — new customer: no saved sandwiches, 1 stamp.
All persona/menu content is synthetic and labeled as demonstration data.

## 5. Authentication (personas + sessions)
- `/signin` lists demo personas as brick cards. Selecting one POSTs to `/api/auth/persona`, which creates a KV session for the seeded user id, sets the httpOnly session cookie, and redirects back (or to `/account`).
- `getCurrentUser()` resolves the cookie → KV → D1 user; RSCs use it for personalization; guarded routes require it.
- Sign-out clears the KV session and cookie.
- Room to add real email/magic-link later without changing the session model.

## 6. Ordering & simulated checkout
- **Menu** (`/menu`, RSC): authored sandwiches from `/menu/query-index.json`; when signed in, a personalization strip ("your usual," loyalty) reads from D1.
- **Build Your Own** (`/build`, client component "The Stack"): reads the ingredients palette (server) and hydrates the configurator; live running price; "Add to cart" / "Save sandwich."
- **Cart** (`/cart`): line items (menu + custom) from KV; quantities; subtotal.
- **Checkout (simulated):** pick a pickup time → POST `/api/orders` → insert order + items into D1, increment loyalty, clear the cart → redirect `/order/[id]` confirmation. No payment step.
- **Account** (`/account`): order history with one-tap reorder (re-adds the snapshot to the cart), saved sandwiches / "my usual," and the loyalty card.

## 7. PWA (installable)
- `app/manifest.js` (Next metadata route): `name` "Stacked", `short_name` "Stacked", `theme_color` `#ff5a2c`, `background_color` `#f8f7f4`, `display` `standalone`, `start_url` `/`, icons at 192/512 plus a maskable variant.
- App icon: a Stacked "brick" mark (Punch square with two stack bars) — authored SVG exported to optimized PNGs with a maskable safe area; committed under `icons/`/`public/`.
- Service worker: a lightweight SW served as a static asset — precache the app shell, network-first for navigations, stale-while-revalidate for `/menu/query-index.json` and `/config/ingredients.plain.html`, and a friendly branded offline fallback. Registered client-side after load; respects the three-phase loading budget.
- iOS: `apple-touch-icon`, `apple-mobile-web-app-capable`, status-bar style; `theme-color` meta.

## 8. Design system & fonts
- The build uses the **Brick Stack** system in [DESIGN.md](../../DESIGN.md); tokens already live in `styles/tokens/`.
- Self-host **Bricolage Grotesque** (display) and **Hanken Grotesk** (body) as subset woff2 in `fonts/`, wired via `styles/tokens/fonts.css`, preloading the display weight. (Currently the tokens name these faces but fall back to system fonts until the files are added.)
- Apply tokens to the existing blocks (hero, cards, columns, steps, tabs, callout) and fix per-block touch-ups (e.g. button text color on the accent variant, card radius/shadow).
- New app UI honors the named rules: one-loud-Punch-field per screen, dark-ink-on-bright, the two-layer stack shadow with a `translateY(3px)` snap-settle, loyalty as studs, the builder as the literal vertical Stack.

## 9. Infrastructure additions
- **wrangler:** create and bind a **D1** database (binding `DB`) and an app **KV** namespace (binding e.g. `APP_KV` for sessions + carts) in `wrangler.jsonc`, alongside the existing R2/KV cache bindings.
- A migrations/seed step (`wrangler d1 migrations`) creates the schema and seeds personas.
- **EDS:** `helix-query.yaml` gains a scoped `menu` index (target `/menu/query-index.json`) with the menu-item properties; `/config/**` is excluded from the default index. (Done in this branch.)
- `EDS_ORIGIN` already points at the `main--…aem.live` origin for catalog + content fetches.

## 10. Demo script (~2 min)
1. Browse the authored **Menu**; open **Build Your Own** and stack a custom sandwich, watching the live price.
2. In EDS, change a menu item's price (its page Metadata) or add a row to the `Ingredients` block → publish → refresh: menu *and* builder update at the edge. *(the EDS moment)*
3. **Sign in as Alex** → the personalization strip shows "your usual" and loyalty.
4. One-tap **reorder** → **simulated checkout** with a pickup time → confirmation + a new loyalty stud persisted in D1. *(the app moment)*
5. **Install** the PWA and reopen it standalone. *(the platform moment)*

## 11. Phasing (each phase can become its own plan)
- **Phase 0 — Foundations:** self-host fonts; apply Brick Stack tokens to existing blocks; PWA manifest + icons + service worker.
- **Phase 1 — Catalog:** add the `menu` index to `helix-query.yaml` (done); author sample `/menu/*` items + the `/config/ingredients` block per the schema; `lib/catalog.js` (`getMenu`/`getIngredients`); `/menu` route + MenuList/MenuCard; home menu highlight; `catalog` revalidation tag wired into `/api/revalidate`.
- **Phase 2 — Builder:** SandwichBuilder client component (The Stack) + ingredient bricks + running price + save/add-to-cart.
- **Phase 3 — Persistence & auth:** D1 schema + persona seed; KV sessions; `/signin`; middleware guard; cart in KV with guest→user merge.
- **Phase 4 — Checkout & account:** cart page; `/api/orders` simulated checkout; `/order/[id]` confirmation; `/account` (history, reorder, saved, loyalty).
- **Phase 5 — Personalization & polish:** personalization strip on menu; reorder; loyalty studs; finish review against DESIGN.md + accessibility (WCAG 2.1 AA); performance pass (keep the RSC zero-JS baseline for content).

## 12. Risks & open questions
- **Route coexistence:** confirm the optional catch-all and explicit app routes resolve as intended (explicit wins), and that `/menu` (app) and `/menu/<slug>` (content) coexist; verify `/` still renders the EDS home.
- **Structured-content indexing:** confirm `/menu/**` pages surface in `/menu/query-index.json` with the custom metadata properties, that `/config/ingredients.plain.html` exposes the `Ingredients` block, and that `/api/revalidate` busts the `catalog` tag when a menu item or the ingredients page publishes.
- **Bindings in dev:** D1/KV access under `opennextjs-cloudflare` local preview vs `next dev` — decide the local dev story (wrangler preview vs a dev shim for `env`).
- **Brand name:** "Stacked" is the working name (swappable).
- **Fonts licensing/size:** subset Bricolage/Hanken; keep committed font files optimized.
- **Service worker vs OpenNext:** ensure the custom SW doesn't conflict with OpenNext asset handling; keep scope and caching conservative.

## 13. Success criteria
- A visitor can browse the authored menu, build and price a custom sandwich, sign in as a persona, reorder, complete a simulated checkout, and see loyalty persist — on one deploy.
- Editing a menu item or the ingredients block and publishing visibly updates the live site without a code change.
- The app is installable as a PWA and looks unmistakably like the Brick Stack system.
- `npm run lint` is clean; content pages keep the RSC zero-client-JS baseline; target Lighthouse ~100 on content routes.
