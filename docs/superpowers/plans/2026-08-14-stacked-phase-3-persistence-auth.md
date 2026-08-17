# Stacked Phase 3 — Persistence & Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Stacked real persistence and one-click demo-persona auth: a Cloudflare D1 schema (users, saved sandwiches, orders, order items) seeded with two personas, KV-backed sessions, a `/signin` page, and a cart library with guest→user merge — the foundation Phase 4 (cart page, checkout, account) builds on.

**Architecture:** D1 (SQL) holds user/transactional data; KV holds ephemeral sessions and carts, mirroring the existing OpenNext tag-cache KV already in `wrangler.jsonc`. `lib/db.js` wraps `getCloudflareContext().env.DB`; `lib/session.js` wraps a signed session cookie ↔ KV lookup; `lib/cart.js` wraps a per-identity cart in KV with a guest-cookie fallback that merges into the user's cart at sign-in. `/signin` is a real page (persona cards in the Brick Stack system) backed by `POST /api/auth/persona` and `POST /api/auth/signout`. `middleware.js` gains a guard that redirects unauthenticated requests to `/account` or `/order/*` to `/signin` (those routes don't exist until Phase 4 — the guard is built and proven now, ahead of the pages it will protect).

**Tech Stack:** Next.js 16 App Router (Route Handlers for POST endpoints, Server Components for reads), Cloudflare D1 + KV via `@opennextjs/cloudflare`'s `getCloudflareContext()`, `next/headers` `cookies()`, Wrangler 4 (Node 22) for migrations and local KV/D1 inspection.

## Global Constraints

- **D1 binding name:** `DB`. **KV binding name for app data:** `APP_KV` (distinct from the existing `NEXT_TAG_CACHE_KV`, which stays OpenNext-only — never read/write app data through it).
- **D1 schema is exactly** (from the spec, `docs/superpowers/specs/2026-08-13-stacked-demo-design.md` §4.2): `users(id, name, email, avatar_initials, is_demo, loyalty_stamps, created_at)`, `saved_sandwiches(id, user_id, name, build_json, created_at)`, `orders(id, user_id, status, pickup_time, subtotal_cents, created_at)`, `order_items(id, order_id, kind[menu|custom], label, unit_price_cents, qty, build_json NULL)`.
- **Personas** (spec §4.4): `alex` (Alex Rivera, `AR`, 7 loyalty stamps, one saved sandwich "The Italian Stack", 3 past orders) and `jordan` (Jordan Lee, `JL`, 1 loyalty stamp, no saved sandwiches, no orders).
- **KV shapes** (spec §4.3): `session:<id>` → `{ userId, expiresAt }`; `cart:<sessionId|userId>` → an array of cart line items.
- **Session cookie:** `stacked_session`, httpOnly, `sameSite: 'lax'`, `secure` in production only (this repo's local dev runs over plain HTTP). **Guest cart cookie:** `stacked_cart`, same attributes. Both live 30 days.
- **No unit-test runner exists.** `getCloudflareContext()` only resolves inside an active Next.js request (dev server or `preview:cf`); `cookies()` from `next/headers` likewise only works inside a request/response cycle. Library code (`lib/db.js`, `lib/session.js`, `lib/cart.js`) is verified by code review + `npm run lint`; **live, end-to-end proof happens via `curl` against a running `next dev` server** in the task that first calls them for real (Task 3), plus direct `wrangler d1 execute --local` / `wrangler kv key get --local` inspection.
- **Local dev needs no Cloudflare login.** `next.config.mjs` already calls `initOpenNextCloudflareForDev()`, which proxies D1/KV bindings declared in `wrangler.jsonc` to local, offline-persisted storage (SQLite under `.wrangler/state`) keyed by whatever `database_id`/KV `id` is declared — a placeholder ID works fine locally. **Provisioning the real, production D1 database and KV namespace requires a Cloudflare login this environment does not have** (`wrangler whoami` → not logged in, non-interactive) — Task 1 uses a clearly-marked placeholder ID and documents the exact commands the user must run once, themselves, before deploying to production. This mirrors how `DEPLOYMENT.md` already documents the equivalent one-time step for the R2/KV cache bindings.
- Node 22 is required for `wrangler` (`~/.nvm/versions/node/v22.16.0/bin/node`); the default shell Node here is v20.
- ES6+ JS, `.js` import extensions, Unix (LF) line endings, `npm run lint` green throughout.
- `lib/` and `app/**/*.jsx` are not covered by `npm run lint:js` (pre-existing `.eslintignore` exclusion, confirmed in Phase 0) — the linter won't catch mistakes in most of this plan's files; the live/local verification steps are the real gate.
- Brand: Brick Stack system (`docs/DESIGN.md`) — Punch `#ff5a2c` (dark ink) as the one loud field/primary action per screen, `--radius-brick`/`--shadow-brick`, Bricolage headings / Hanken body, the `translateY(3px)` snap-settle already on `.button.primary`.

## File Structure

- `wrangler.jsonc` — modify. Add `d1_databases` (binding `DB`) and `kv_namespaces` (binding `APP_KV`) alongside the existing R2/KV bindings.
- `migrations/0001_schema.sql` — create. The four-table schema + indexes.
- `migrations/0002_seed_personas.sql` — create. Insert Alex + Jordan and Alex's saved sandwich/orders/order items.
- `lib/db.js` — create. `getDb()`, `getUserById(id)`, `getPersonas()`.
- `lib/session.js` — create. `createSession(userId)`, `destroySession(sessionId)`, `getSessionIdFromCookies()`, `getCurrentUser()`, `SESSION_COOKIE`.
- `lib/cart.js` — create. `getCart(user)`, `saveCart(user, items)`, `mergeGuestCartIntoUser(userId)`, `CART_COOKIE`.
- `app/(site)/signin/page.js` — create. RSC: persona cards.
- `app/(site)/signin/signin.css` — create. Brick Stack styling for the persona cards.
- `app/api/auth/persona/route.js` — create. `POST` — create session, merge guest cart, set cookie, redirect.
- `app/api/auth/signout/route.js` — create. `POST` — destroy session, clear cookie, redirect.
- `middleware.js` — modify. Add the `/account` and `/order` auth guard alongside the existing www→apex redirect.

---

### Task 1: D1 + KV bindings, schema, and persona seed

**Files:**
- Modify: `wrangler.jsonc`
- Create: `migrations/0001_schema.sql`, `migrations/0002_seed_personas.sql`
- Verify: `wrangler d1 migrations apply --local` + direct `wrangler d1 execute --local` queries

**Interfaces:**
- Produces: a local D1 database named `stacked-db` (binding `DB`) with the four tables above, seeded with `alex` and `jordan`. A local KV namespace (binding `APP_KV`) exists (empty until Task 3 writes to it). Every later task in this plan depends on this schema and this exact seed data.

- [ ] **Step 1: Add the bindings to `wrangler.jsonc`.** Add these two top-level keys after the existing `kv_namespaces` array (keep the existing `NEXT_TAG_CACHE_KV` entry untouched):

```jsonc
  // App data: users, saved sandwiches, orders, loyalty (Stacked persistence — see
  // docs/superpowers/specs/2026-08-13-stacked-demo-design.md §4). The database_id below is a
  // placeholder for local dev, which persists to .wrangler/state regardless of the ID's
  // validity. Before deploying to production, run `npx wrangler d1 create stacked-db` and
  // replace database_id with the real UUID it prints.
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "stacked-db",
      "database_id": "00000000-0000-0000-0000-000000000000",
      "migrations_dir": "migrations"
    }
  ],
  // Sessions (session:<id> -> {userId, expiresAt}) and carts (cart:<sessionId|userId> -> items).
  // Distinct from NEXT_TAG_CACHE_KV above, which is OpenNext-internal only. The id below is a
  // placeholder for local dev (see the d1_databases comment); before deploying to production,
  // run `npx wrangler kv namespace create stacked-app-kv` and replace it with the real id.
  "kv_namespaces": [
    {
      "binding": "NEXT_TAG_CACHE_KV",
      "id": "7c290fe8865d479d8aafb1a8b36e49fc"
    },
    {
      "binding": "APP_KV",
      "id": "00000000000000000000000000000001"
    }
  ]
```

This REPLACES the existing single-entry `kv_namespaces` array with a two-entry array (keep `NEXT_TAG_CACHE_KV`'s existing id `7c290fe8865d479d8aafb1a8b36e49fc` exactly as-is) and ADDS the new `d1_databases` array. Confirm the file is still valid JSONC (comments are fine; this file already has several).

- [ ] **Step 2: Write the schema migration** `migrations/0001_schema.sql`:

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  avatar_initials TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  loyalty_stamps INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE saved_sandwiches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  build_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL,
  pickup_time TEXT,
  subtotal_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  kind TEXT NOT NULL CHECK (kind IN ('menu', 'custom')),
  label TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  build_json TEXT
);

CREATE INDEX idx_saved_sandwiches_user ON saved_sandwiches(user_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
```

- [ ] **Step 3: Write the persona seed migration** `migrations/0002_seed_personas.sql`:

```sql
INSERT INTO users (id, name, email, avatar_initials, is_demo, loyalty_stamps) VALUES
  ('alex', 'Alex Rivera', 'alex@example.com', 'AR', 1, 7),
  ('jordan', 'Jordan Lee', 'jordan@example.com', 'JL', 1, 1);

INSERT INTO saved_sandwiches (id, user_id, name, build_json) VALUES
  ('seed-saved-1', 'alex', 'The Italian Stack', '{"kind":"menu","slug":"italian-stack"}');

INSERT INTO orders (id, user_id, status, pickup_time, subtotal_cents, created_at) VALUES
  ('seed-order-1', 'alex', 'completed', '12:30', 1100, datetime('now', '-14 days')),
  ('seed-order-2', 'alex', 'completed', '12:45', 2500, datetime('now', '-7 days')),
  ('seed-order-3', 'alex', 'completed', '12:15', 2000, datetime('now', '-2 days'));

INSERT INTO order_items (id, order_id, kind, label, unit_price_cents, qty, build_json) VALUES
  ('seed-item-1', 'seed-order-1', 'menu', 'The Italian Stack', 1100, 1, NULL),
  ('seed-item-2', 'seed-order-2', 'custom', 'Green Machine', 1400, 1, '{"bread":"Sourdough"}'),
  ('seed-item-3', 'seed-order-2', 'menu', 'The Cubano', 1100, 1, NULL),
  ('seed-item-4', 'seed-order-3', 'menu', 'Turkey Club Stack', 1000, 2, NULL);
```

- [ ] **Step 4: Apply both migrations locally** (Node 22 for wrangler):

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
npx wrangler d1 migrations apply stacked-db --local
```

Expected: output lists both `0001_schema.sql` and `0002_seed_personas.sql` as applied, no errors.

- [ ] **Step 5: Verify the schema and seed data directly.**

```bash
npx wrangler d1 execute stacked-db --local --command "SELECT id, name, avatar_initials, loyalty_stamps FROM users ORDER BY id"
npx wrangler d1 execute stacked-db --local --command "SELECT COUNT(*) AS n FROM orders WHERE user_id = 'alex'"
npx wrangler d1 execute stacked-db --local --command "SELECT COUNT(*) AS n FROM saved_sandwiches WHERE user_id = 'jordan'"
```

Expected: first query returns exactly `alex` (AR, 7) and `jordan` (JL, 1); second returns `n: 3`; third returns `n: 0` (Jordan has no saved sandwiches).

- [ ] **Step 6: Confirm the KV namespace binding resolves locally** (no data yet — just proving the binding exists):

```bash
npx wrangler kv key put --binding=APP_KV "smoke-test" "ok" --local
npx wrangler kv key get --binding=APP_KV "smoke-test" --local
npx wrangler kv key delete --binding=APP_KV "smoke-test" --local
```

Expected: the `get` prints `ok`.

- [ ] **Step 7: Commit.**

```bash
git add wrangler.jsonc migrations/
git commit -m "feat(persistence): add D1 schema and persona seed, KV app-data binding

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `lib/db.js`, `lib/session.js`, `lib/cart.js`

**Files:**
- Create: `lib/db.js`, `lib/session.js`, `lib/cart.js`
- Verify: `npm run lint`; full live proof deferred to Task 3, which is the first real caller (`getCloudflareContext()` and `cookies()` only resolve inside an active Next.js request — there is no way to exercise these standalone, and this task's Global Constraints section discloses that explicitly)

**Interfaces:**
- Consumes: the `DB` and `APP_KV` bindings from Task 1's `wrangler.jsonc`; the `users` schema from Task 1.
- Produces (used by Task 3 and by Phase 4):
  - `lib/db.js`: `getDb(): D1Database`, `async getUserById(id: string): Promise<object|null>`, `async getPersonas(): Promise<object[]>` (rows: `id, name, avatar_initials, loyalty_stamps`, `is_demo = 1` only, ordered by `id`).
  - `lib/session.js`: `SESSION_COOKIE = 'stacked_session'`, `async createSession(userId: string): Promise<string>` (returns the new session id), `async destroySession(sessionId: string): Promise<void>`, `async getSessionIdFromCookies(): Promise<string|null>`, `async getCurrentUser(): Promise<object|null>`.
  - `lib/cart.js`: `CART_COOKIE = 'stacked_cart'`, `async getCartKey(user: object|null): Promise<string>` (returns `` `cart:${user.id}` `` or `` `cart:${guestId}` ``, creating+setting the guest cookie if needed), `async getCart(user: object|null): Promise<Array>`, `async saveCart(user: object|null, items: Array): Promise<void>`, `async mergeGuestCartIntoUser(userId: string): Promise<void>` (no-op if no guest cart cookie is present).

- [ ] **Step 1: Write `lib/db.js`:**

```js
import { getCloudflareContext } from '@opennextjs/cloudflare';

// D1 access for Stacked's persistence (users, saved sandwiches, orders, loyalty). See
// docs/superpowers/specs/2026-08-13-stacked-demo-design.md §4.2 for the schema and
// migrations/0001_schema.sql for the DDL. Only callable inside an active Next.js request
// (Route Handler or Server Component) — getCloudflareContext() has no meaning outside one.

/** @returns {import('@cloudflare/workers-types').D1Database} */
export function getDb() {
  return getCloudflareContext().env.DB;
}

/**
 * @param {string} id
 * @returns {Promise<{id:string,name:string,email:string|null,avatar_initials:string,
 *   is_demo:number,loyalty_stamps:number,created_at:string}|null>}
 */
export async function getUserById(id) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
}

/**
 * The demo sign-in list: every seeded persona, ordered for a stable UI.
 * @returns {Promise<{id:string,name:string,avatar_initials:string,loyalty_stamps:number}[]>}
 */
export async function getPersonas() {
  const { results } = await getDb()
    .prepare('SELECT id, name, avatar_initials, loyalty_stamps FROM users WHERE is_demo = 1 ORDER BY id')
    .all();
  return results;
}
```

- [ ] **Step 2: Write `lib/session.js`:**

```js
import { cookies } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getUserById } from './db.js';

// Session cookie <-> KV lookup. session:<id> -> { userId, expiresAt } (see
// docs/superpowers/specs/2026-08-13-stacked-demo-design.md §4.3 / §5). KV's own
// expirationTtl does the real garbage collection; expiresAt is carried in the value too so
// app code can read freshness without a separate metadata call.

export const SESSION_COOKIE = 'stacked_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getKv() {
  return getCloudflareContext().env.APP_KV;
}

/**
 * @param {string} userId
 * @returns {Promise<string>} the new session id
 */
export async function createSession(userId) {
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  await getKv().put(`session:${sessionId}`, JSON.stringify({ userId, expiresAt }), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return sessionId;
}

/** @param {string} sessionId */
export async function destroySession(sessionId) {
  if (!sessionId) return;
  await getKv().delete(`session:${sessionId}`);
}

/** @returns {Promise<string|null>} */
export async function getSessionIdFromCookies() {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

/** Resolve the signed-in user from the session cookie, or null for a guest. Safe to call from
 * a Server Component (read-only cookie access) or a Route Handler.
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
  const sessionId = await getSessionIdFromCookies();
  if (!sessionId) return null;
  const raw = await getKv().get(`session:${sessionId}`);
  if (!raw) return null;
  const { userId } = JSON.parse(raw);
  return getUserById(userId);
}
```

- [ ] **Step 3: Write `lib/cart.js`:**

```js
import { cookies } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Cart in KV, keyed by whichever identity is active: a signed-in user's id, or a guest cart
// cookie for an anonymous visitor. On sign-in, mergeGuestCartIntoUser folds the guest cart
// into the user's cart and clears the guest cookie. See
// docs/superpowers/specs/2026-08-13-stacked-demo-design.md §4.3.

export const CART_COOKIE = 'stacked_cart';
const CART_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getKv() {
  return getCloudflareContext().env.APP_KV;
}

/** Read the guest cart cookie without creating one (used by the merge step, which must not
 * mint a fresh empty guest cart just to look for one). @returns {Promise<string|null>} */
async function readGuestCartId() {
  const jar = await cookies();
  return jar.get(CART_COOKIE)?.value ?? null;
}

/** Read the guest cart cookie, creating and setting one if the visitor doesn't have one yet.
 * Only call this from a Route Handler (or other context where cookies() is mutable) — Server
 * Components may only read cookies. @returns {Promise<string>} */
async function getOrCreateGuestCartId() {
  const jar = await cookies();
  let id = jar.get(CART_COOKIE)?.value;
  if (!id) {
    id = crypto.randomUUID();
    jar.set(CART_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: CART_COOKIE_MAX_AGE_SECONDS,
      path: '/',
    });
  }
  return id;
}

/**
 * @param {{id:string}|null} user
 * @returns {Promise<string>} the KV key for this identity's cart
 */
export async function getCartKey(user) {
  return user ? `cart:${user.id}` : `cart:${await getOrCreateGuestCartId()}`;
}

/**
 * @param {{id:string}|null} user
 * @returns {Promise<Array>} the cart's line items, or [] if empty/never created
 */
export async function getCart(user) {
  const raw = await getKv().get(await getCartKey(user));
  return raw ? JSON.parse(raw) : [];
}

/**
 * @param {{id:string}|null} user
 * @param {Array} items
 */
export async function saveCart(user, items) {
  await getKv().put(await getCartKey(user), JSON.stringify(items));
}

/** Fold a guest's cart (if any) into the just-signed-in user's cart, then clear the guest
 * cookie. Appends guest items after the user's existing items; a no-op if there is no guest
 * cart cookie or it points at an empty/missing cart.
 * @param {string} userId
 */
export async function mergeGuestCartIntoUser(userId) {
  const guestId = await readGuestCartId();
  if (!guestId) return;

  const kv = getKv();
  const guestRaw = await kv.get(`cart:${guestId}`);
  if (guestRaw) {
    const guestItems = JSON.parse(guestRaw);
    const userRaw = await kv.get(`cart:${userId}`);
    const userItems = userRaw ? JSON.parse(userRaw) : [];
    await kv.put(`cart:${userId}`, JSON.stringify([...userItems, ...guestItems]));
    await kv.delete(`cart:${guestId}`);
  }

  const jar = await cookies();
  jar.delete(CART_COOKIE);
}
```

- [ ] **Step 4: Run `npm run lint`.**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 5: Commit.**

```bash
git add lib/db.js lib/session.js lib/cart.js
git commit -m "feat(persistence): add D1 and session/cart libraries

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `/signin` page + persona sign-in/sign-out routes

**Files:**
- Create: `app/(site)/signin/page.js`, `app/(site)/signin/signin.css`, `app/api/auth/persona/route.js`, `app/api/auth/signout/route.js`
- Verify: `npm run lint`; live `curl` against a running `next dev` server, proving `lib/db.js`, `lib/session.js`, and `lib/cart.js` (Task 2) actually work end-to-end for the first time

**Interfaces:**
- Consumes: `getPersonas()` (`lib/db.js`), `createSession`/`destroySession`/`getSessionIdFromCookies`/`SESSION_COOKIE` (`lib/session.js`), `mergeGuestCartIntoUser` (`lib/cart.js`).
- Produces: `GET /signin` (a real page), `POST /api/auth/persona` (body or form field `personaId`; sets `stacked_session`, redirects to `/`), `POST /api/auth/signout` (clears `stacked_session`, redirects to `/`). Task 4's middleware guard redirects unauthenticated requests to `/signin`.

**Verification strategy — read before Step 6.** This task is the first time anything in this codebase calls `getCloudflareContext().env.DB`/`.env.APP_KV` from inside a real request. Only R2 (the incremental cache) has been proven to work this way under `next dev` so far (Phase 0) — D1/KV specifically are unverified in this repo. Try `next dev` first (Steps 6-11 below); if any `curl` call in this task returns a 500 or an error body mentioning a missing/undefined binding (rather than the expected response), STOP treating `next dev` as the verification environment and switch to `npm run preview:cf` instead (`nvm use 22` first) — the actual built Cloudflare Worker under workerd, already proven in Phase 0 to correctly resolve bindings. `preview:cf` reads the SAME local D1/KV persistence Task 1 already populated (`.wrangler/state`), so no re-migration is needed — just re-run Steps 7-10's `curl` calls against `preview:cf`'s URL/port instead of `next dev`'s. Report in your task report which environment actually worked.

- [ ] **Step 1: Write `app/api/auth/persona/route.js`:**

```js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserById } from '../../../../lib/db.js';
import { createSession, SESSION_COOKIE } from '../../../../lib/session.js';
import { mergeGuestCartIntoUser } from '../../../../lib/cart.js';

const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// One-click demo sign-in: POST { personaId } (or a form field of the same name) -> verify the
// persona exists, create a KV session, merge any guest cart into it, set the session cookie,
// and redirect. See docs/superpowers/specs/2026-08-13-stacked-demo-design.md §5.
export async function POST(request) {
  let personaId;
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    ({ personaId } = await request.json());
  } else {
    const form = await request.formData();
    personaId = form.get('personaId');
  }

  const user = personaId ? await getUserById(String(personaId)) : null;
  if (!user || !user.is_demo) {
    return NextResponse.json({ error: 'Unknown persona' }, { status: 400 });
  }

  const sessionId = await createSession(user.id);
  await mergeGuestCartIntoUser(user.id);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });

  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
```

- [ ] **Step 2: Write `app/api/auth/signout/route.js`:**

```js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession, getSessionIdFromCookies, SESSION_COOKIE } from '../../../../lib/session.js';

export async function POST(request) {
  const sessionId = await getSessionIdFromCookies();
  await destroySession(sessionId);

  const jar = await cookies();
  jar.delete(SESSION_COOKIE);

  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
```

- [ ] **Step 3: Write `app/(site)/signin/page.js`** (RSC — reads personas server-side, no client JS needed for the list itself; each card is a plain HTML form POSTing to the persona route, so it works with JS disabled):

```js
import { getPersonas } from '../../../lib/db.js';
import './signin.css';

export const metadata = { title: 'Sign in — Stacked' };

export default async function SignInPage() {
  const personas = await getPersonas();

  return (
    <main className="signin-page">
      <div className="signin-card">
        <h1>Sign in</h1>
        <p className="signin-lede">Pick a demo account to explore Stacked as a returning customer.</p>
        <div className="signin-personas">
          {personas.map((persona) => (
            <form key={persona.id} action="/api/auth/persona" method="POST" className="signin-persona">
              <input type="hidden" name="personaId" value={persona.id} />
              <span className="signin-avatar" aria-hidden="true">{persona.avatar_initials}</span>
              <span className="signin-persona-info">
                <span className="signin-persona-name">{persona.name}</span>
                <span className="signin-persona-meta">{persona.loyalty_stamps} loyalty stamp{persona.loyalty_stamps === 1 ? '' : 's'}</span>
              </span>
              <button type="submit" className="button primary signin-persona-btn">Sign in as {persona.name.split(' ')[0]}</button>
            </form>
          ))}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Write `app/(site)/signin/signin.css`** (Brick Stack: the card rests on the stack shadow, one primary button per persona, dark ink on the punch avatar):

```css
.signin-page {
  display: flex;
  justify-content: center;
  padding: var(--space-xl) var(--space-s);
}

.signin-card {
  width: 100%;
  max-width: 420px;
  background: var(--surface-card);
  border-radius: var(--radius-brick-lg);
  box-shadow: var(--shadow-brick);
  padding: var(--space-l) var(--space-m);
}

.signin-card h1 {
  margin-top: 0;
}

.signin-lede {
  color: var(--text-muted);
  margin-bottom: var(--space-m);
}

.signin-personas {
  display: flex;
  flex-direction: column;
  gap: var(--space-s);
}

.signin-persona {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  background: var(--surface-tint);
  border-radius: var(--radius-card);
  padding: var(--space-xs) var(--space-s);
}

.signin-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: var(--radius-round);
  background: var(--brand-sun);
  color: var(--on-sun);
  font-weight: var(--weight-bold);
}

.signin-persona-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.signin-persona-name {
  font-weight: var(--weight-bold);
}

.signin-persona-meta {
  font-size: var(--body-font-size-xs);
  color: var(--text-muted);
}

.signin-persona-btn {
  flex: none;
}

@media (width < 600px) {
  .signin-persona {
    flex-wrap: wrap;
  }

  .signin-persona-btn {
    width: 100%;
  }
}
```

- [ ] **Step 5: Lint.**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 6: Live-verify end to end.** Start the dev server in the background and watch for its actual port (this worktree has bound `3319` before, not always `3000`):

```bash
npm run dev &
sleep 3
```

Read the actual port from the dev server's own startup output before continuing (grep its log or check the terminal), then substitute it for `$PORT` below.

- [ ] **Step 7: Verify the sign-in page renders both personas.**

```bash
curl -s "http://localhost:$PORT/signin" | grep -oE "Alex Rivera|Jordan Lee|Sign in as Alex|Sign in as Jordan"
```

Expected: all four strings present.

- [ ] **Step 8: Verify persona sign-in creates a real session and sets the cookie.**

```bash
curl -sD - -o /dev/null -X POST "http://localhost:$PORT/api/auth/persona" \
  --data "personaId=alex" \
  -c /tmp/stacked-cookies.txt
```

Expected: a `303` status, a `Location: /` header, and a `Set-Cookie: stacked_session=...` header. Then confirm the session actually exists in KV — extract the cookie value from `/tmp/stacked-cookies.txt` and check:

```bash
SESSION_ID=$(grep stacked_session /tmp/stacked-cookies.txt | awk '{print $7}')
npx wrangler kv key get --binding=APP_KV "session:$SESSION_ID" --local
```

Expected: JSON containing `"userId":"alex"`.

- [ ] **Step 9: Verify the guest→user cart merge.** Simulate a guest who already added something to their cart before signing in, by writing directly to a guest cart key and setting the matching cookie, then signing in as Jordan (a fresh persona with no pre-existing cart) and confirming the merge:

```bash
npx wrangler kv key put --binding=APP_KV "cart:guest-test-123" '[{"kind":"menu","label":"Test Item","unitPriceCents":500,"qty":1}]' --local

curl -sD - -o /dev/null -X POST "http://localhost:$PORT/api/auth/persona" \
  --data "personaId=jordan" \
  -b "stacked_cart=guest-test-123" \
  -c /tmp/stacked-cookies-jordan.txt

npx wrangler kv key get --binding=APP_KV "cart:jordan" --local
npx wrangler kv key get --binding=APP_KV "cart:guest-test-123" --local
```

Expected: `cart:jordan` now contains the `"Test Item"` line item (the merge worked); `cart:guest-test-123` returns nothing (the guest key was deleted). Also confirm the response headers from the `curl -sD -` output include `Set-Cookie: stacked_cart=` with an empty/expired value (the guest cookie was cleared).

- [ ] **Step 10: Verify sign-out destroys the session.**

```bash
curl -sD - -o /dev/null -X POST "http://localhost:$PORT/api/auth/signout" -b /tmp/stacked-cookies.txt
npx wrangler kv key get --binding=APP_KV "session:$SESSION_ID" --local
```

Expected: the `wrangler kv key get` call now returns nothing (the session was deleted from KV).

- [ ] **Step 11: Stop the dev server.**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 12: Commit.**

```bash
git add "app/(site)/signin" app/api/auth
git commit -m "feat(auth): add /signin persona sign-in and sign-out routes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Middleware auth guard for `/account` and `/order`

**Files:**
- Modify: `middleware.js`
- Verify: a standalone script that directly invokes the exported `middleware()` function (no server needed), plus a live `curl` check against `next dev`

**Interfaces:**
- Consumes: nothing imported from `lib/session.js` — middleware.js deliberately keeps its OWN copy of the cookie name as a literal string, never importing `lib/session.js` (which pulls in `@opennextjs/cloudflare` and `next/headers`). Next Middleware runs in a separate, restricted Edge runtime; importing Cloudflare-binding/Node-ish code into it is a known way to break the middleware bundle even when nothing in the imported module is actually called. If `lib/session.js`'s `SESSION_COOKIE` value (`'stacked_session'`) ever changes, this literal must be updated too — a `// keep in sync` comment marks both sides. This guard checks **cookie presence only** — Phase 4's actual `/account` and `/order` routes are responsible for validating the session is genuinely valid via `getCurrentUser()`, exactly as the spec states: "redirect to `/signin` when no session cookie; full validation happens in the route".
- Produces: unauthenticated requests to `/account` or `/order` (and any sub-path, e.g. `/order/abc123`) redirect to `/signin`; every other route's existing behavior (www→apex redirect, `Cache-Tag` header) is unchanged.

- [ ] **Step 1: Modify `middleware.js`** to add the guard. Replace the full file with:

```js
import { NextResponse } from 'next/server';

// Tag each rendered page response with a deterministic Cloudflare cache tag derived from
// the URL: `page:<slug>`. This mirrors the Next data-cache tags set in lib/eds/fetch.js,
// so EDS push invalidation (purge-by-cache-tag on the BYO Cloudflare CDN) and the
// /api/revalidate endpoint both target the same key when an author publishes.
//
// Also guards /account and /order: a request with no session cookie is redirected to
// /signin. This checks cookie PRESENCE only (Middleware runs in the Edge runtime, where a KV
// lookup per request would add latency to every navigation) — the guarded routes themselves
// call getCurrentUser() for full validation. See
// docs/superpowers/specs/2026-08-13-stacked-demo-design.md §3.2.
//
// SESSION_COOKIE is duplicated from lib/session.js rather than imported: that module pulls in
// @opennextjs/cloudflare and next/headers, and Middleware's Edge runtime is a known place for
// that kind of import to break the bundle even when nothing in it is actually called. Keep
// this literal in sync with lib/session.js's SESSION_COOKIE export.
const SESSION_COOKIE = 'stacked_session'; // keep in sync with lib/session.js
const GUARDED_PREFIXES = ['/account', '/order'];

export function middleware(request) {
  // Canonicalize www → apex (301), preserving path and query.
  if (request.nextUrl.hostname === 'www.nxtjs.page') {
    const url = request.nextUrl.clone();
    url.hostname = 'nxtjs.page';
    return NextResponse.redirect(url, 301);
  }

  const { pathname } = request.nextUrl;
  const isGuarded = GUARDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isGuarded && !request.cookies.get(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  const slug = request.nextUrl.pathname.replace(/^\/+|\/+$/g, '') || 'index';
  res.headers.set('Cache-Tag', `page:${slug}`);
  return res;
}

export const config = {
  // Run on page routes only; skip Next internals, the revalidate API, and assets.
  matcher: ['/((?!_next/|api/|.*\\.[^/]+$).*)'],
};
```

- [ ] **Step 2: Verify the guard logic directly**, without a running server (Node 22 — `NextRequest` construction needs the same runtime this project already standardizes on):

```bash
~/.nvm/versions/node/v22.16.0/bin/node --input-type=module -e "
const { NextRequest } = await import('next/server');
const { middleware } = await import('./middleware.js');

const noCookie = new NextRequest('https://nxtjs.page/account');
const res1 = middleware(noCookie);
console.log('no cookie -> status:', res1.status, 'location:', res1.headers.get('location'));

const withCookie = new NextRequest('https://nxtjs.page/account', { headers: { cookie: 'stacked_session=abc123' } });
const res2 = middleware(withCookie);
console.log('with cookie -> status:', res2.status, 'cache-tag:', res2.headers.get('cache-tag'));

const orderSub = new NextRequest('https://nxtjs.page/order/xyz');
const res3 = middleware(orderSub);
console.log('order subpath, no cookie -> status:', res3.status, 'location:', res3.headers.get('location'));

const unguarded = new NextRequest('https://nxtjs.page/menu');
const res4 = middleware(unguarded);
console.log('unguarded route -> status:', res4.status, 'cache-tag:', res4.headers.get('cache-tag'));

const wwwCase = new NextRequest('https://www.nxtjs.page/menu');
const res5 = middleware(wwwCase);
console.log('www redirect -> status:', res5.status, 'location:', res5.headers.get('location'));
"
```

Expected exactly:
- `no cookie -> status: 307 location: https://nxtjs.page/signin?from=%2Faccount`
- `with cookie -> status: 200 cache-tag: page:account`
- `order subpath, no cookie -> status: 307 location: https://nxtjs.page/signin?from=%2Forder%2Fxyz`
- `unguarded route -> status: 200 cache-tag: page:menu`
- `www redirect -> status: 301 location: https://nxtjs.page/menu`

(If the exact status code Next.js's `NextResponse.redirect` produces differs slightly from `307` in the installed version, that's fine — confirm it's a redirect status (3xx) and the `location` header is correct; report the actual code observed.)

- [ ] **Step 3: Live-verify against a running dev server**, confirming the guard also works through the real HTTP stack (middleware unit-testing can diverge from real request handling in subtle ways — e.g. cookie parsing):

```bash
npm run dev &
sleep 3
# read the actual port from the dev server's own startup output, substitute for $PORT below
curl -sD - -o /dev/null "http://localhost:$PORT/account"
```

Expected: a redirect response with a `location` header pointing at `/signin?from=%2Faccount`.

```bash
curl -sD - -o /dev/null "http://localhost:$PORT/menu"
kill %1 2>/dev/null || true
```

Expected: a normal `200` for `/menu` (unguarded, unaffected by this change).

- [ ] **Step 4: Lint.**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 5: Commit.**

```bash
git add middleware.js
git commit -m "feat(auth): guard /account and /order behind a session-cookie check

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 3 acceptance

- `wrangler d1 execute stacked-db --local` shows the four tables and both seeded personas with their orders/saved sandwich exactly as specified.
- `/signin` renders both personas; signing in as either sets a real KV-backed session and redirects; signing out destroys it.
- A guest's pre-existing cart is folded into a persona's cart on sign-in, verified directly via KV.
- `/account` and `/order/*` redirect to `/signin` with no session cookie; every other route (including `/menu`, `/build`, and the www→apex redirect) is unaffected.
- `npm run lint` is green throughout.

## Not in this phase (next up)

- Phase 4 — Checkout & account: `/cart` page (the builder's "Add to cart" UI wiring lands here, not in Phase 3), `POST /api/orders` simulated checkout, `/order/[id]` confirmation, `/account` (order history, reorder, saved sandwiches, loyalty card). See the [demo spec](../specs/2026-08-13-stacked-demo-design.md) §11.
