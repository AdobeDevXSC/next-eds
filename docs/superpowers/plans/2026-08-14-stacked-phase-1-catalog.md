# Stacked Phase 1 — Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the menu and the build-your-own ingredient palette real, authored EDS structured content that drives the app — a `/menu` route reading an indexed feed of menu-item pages, a parsed `Ingredients` block for the builder's palette, a home-page highlight, and publish-time cache busting — so editing a menu item or the ingredients block and publishing visibly updates the live site.

**Architecture:** EDS remains the headless content source; a scoped `menu` query-index (already added to `helix-query.yaml` in Phase 0's baseline) indexes `/menu/**` pages into `/menu/query-index.json`, and a single authored `Ingredients` block on `/config/ingredients` holds the builder palette. `lib/catalog.js` is the one module the app calls for catalog data — it fetches and validates both, tagged `catalog` for shared on-publish revalidation. `/menu` is an explicit Next App Router route (a literal `app/(site)/menu/page.js`, which Next resolves before the sibling optional catch-all `app/(site)/[[...slug]]/page.js`), so it shares the site's header/nav/footer layout while reading structured data instead of parsed EDS block markup. Individual `/menu/<slug>` item pages need no new route — they already fall through to the existing catch-all as ordinary EDS content.

**Tech Stack:** Next.js 16 App Router + RSC (all new UI in this phase is a Server Component — zero added client JS), `node-html-parser` (already a dependency, via the existing `lib/eds/parse.js`), plain CSS with custom properties. Design system: [docs/DESIGN.md](../../DESIGN.md). Content schema: [docs/content-schema.md](../../content-schema.md). Parent spec: [docs/superpowers/specs/2026-08-13-stacked-demo-design.md](../specs/2026-08-13-stacked-demo-design.md) §3–4, §11 Phase 1.

## Global Constraints

- Catalog fields, validation rules, and the `Ingredients` block schema are defined in [docs/content-schema.md](../../content-schema.md) — follow its "App validation" section exactly: only `name`, `image`, and a valid `price` are hard-required for a menu row (drop the row, don't throw, if any is missing/invalid); `category` defaults to `signature` when absent/unknown; `description`/`tags`/`special` all have safe defaults. Ingredient rows require `type` (one of `bread|protein|cheese|veg|sauce|extra`), `name`, and a valid `price`; invalid rows are dropped the same way.
- Prices are authored as decimal USD strings (e.g. `"11"`, `"8.50"`) and must be coerced to integer cents in code — never do float arithmetic on dollar strings downstream.
- Brand tokens (from [docs/DESIGN.md](../../DESIGN.md)) govern all new UI: brick radius `var(--radius-brick)` (20px), the two-layer stack shadow `var(--shadow-brick)` / `var(--shadow-pop)`, brand colors as `var(--brand-*)` / `var(--on-*)`, the spacing scale `var(--space-*)`, and `var(--heading-font-family)` / `var(--body-font-family)`. No hardcoded hex colors in new CSS.
- **Lint reality (important, non-obvious):** `.eslintignore` excludes `app` and `lib` entirely — `npm run lint:js` does **not** check any file this phase touches. Write clean Airbnb-style JS anyway (match the existing `lib/eds/*.js` style exactly: named exports, JSDoc typedefs, `.js` import extensions, no semicolon surprises), but do not treat a green `npm run lint` as proof this phase's JS is correct — real verification is running the code (dev server, curl, a short Node script), not the linter.
- `npm run lint:css` (stylelint standard) **does** cover new CSS once Task 3 widens its glob to include `app/**/*.css` (currently only `blocks/**/*.css` and `styles/*.css`) — keep all new CSS stylelint-clean under that widened glob.
- No unit-test runner exists in this repo. Every task's "test" is: the widened lint gates that actually apply, a Node script exercising the real code against realistic fixture data (not a mocking framework — plain `globalThis.fetch` monkey-patching in a throwaway script, never committed), and/or `curl`/dev-server/browser checks. These are the legitimate test gates — do not introduce a test framework.
- Unix (LF) line endings; ES6+ JS with `.js` import extensions everywhere (per the existing `lib/eds/*.js` convention).
- The real EDS content origin (`EDS_ORIGIN`, defaulting to `https://main--next-eds--AdobeDevXSC.aem.page`) currently has **no** `/menu/*` pages and **no** `/config/ingredients` page authored — `/menu/query-index.json` and `/config/ingredients.plain.html` both 404 today. This is expected. Every task's code must degrade gracefully (empty array / empty palette / `null`, never a thrown error or a 500) when the catalog isn't authored yet, and every task's live-network verification step should expect exactly that "empty but not broken" result today.
- Never publish or modify content in the real DA/EDS content source (`content.da.live/AdobeDevXSC/next-eds/`) as part of this plan — Task 6 prepares local files only and ends by asking the user for help getting them authored. Do not use any `da_*` content-authoring tool in this plan.

## File Structure

- `lib/eds/fetch.js` — generalize `fetchPlainHtml` to accept extra cache tags (modify only; existing callers unaffected).
- `lib/eds/queryIndex.js` — generalize `fetchQueryIndex` to accept a feed path and extra cache tags (modify only; existing callers unaffected).
- `lib/catalog.js` — new. Owns `getMenu()` and `getIngredients()`: fetch, validate, and coerce the two authored feeds into the shapes the app consumes.
- `app/(site)/menu/page.js` — new. The explicit `/menu` route: renders the authored menu as a grid of `MenuCard`s.
- `app/(site)/menu/MenuCard.jsx` — new. Presentational card for one menu item; links to `/menu/<slug>`.
- `app/(site)/menu/MenuHighlight.jsx` — new. "Today's picks" strip, reused by the home page.
- `app/(site)/menu/menu.css` — new. Card + `/menu` page layout (imported by `page.js` and `MenuCard.jsx`).
- `app/(site)/menu/menu-highlight.css` — new. The highlight strip's own wrapper/grid styles.
- `app/(site)/[[...slug]]/page.js` — modify. Inject `MenuHighlight` on the home page only (`path === ''`).
- `app/api/revalidate/route.js` — modify. Also bust the `catalog` tag when the published slug is `config/ingredients` or starts with `menu/`.
- `package.json` — modify. Widen `lint:css`'s glob to include `app/**/*.css`.
- `content-samples/menu/*.md`, `content-samples/config/ingredients.md` — new. Authoring-ready sample content (not published) for Task 6.

---

### Task 1: Generalize `fetchPlainHtml` and `fetchQueryIndex` for the catalog

**Files:**
- Modify: `lib/eds/fetch.js`, `lib/eds/queryIndex.js`
- Verify: dev server regression check + a live network probe against the real (currently-empty) catalog endpoints

**Interfaces:**
- Produces: `fetchPlainHtml(slug = '', { tags = [] } = {})` — same behavior as before when called with no second argument (existing 3 call sites in `lib/eds/fragments.js` and `app/(site)/[[...slug]]/page.js` are unaffected); when `tags` is passed, those tags are added alongside the existing `page:<slug>` tag.
- Produces: `fetchQueryIndex(feedPath = 'query-index.json', { tags = [] } = {})` — same behavior as before when called with no arguments (existing call sites in `lib/eds/metadata.js`, `app/(site)/layout.js`, and `app/(site)/[[...slug]]/page.js` are unaffected); a different `feedPath` fetches that feed instead, and `tags` are attached to the underlying fetch for revalidation.

- [ ] **Step 1: Edit `lib/eds/fetch.js`.** Change the `fetchPlainHtml` signature and the `next` option to merge in extra tags:

```js
/**
 * Fetch the delivered semantic HTML body for a page (the same artifact aem.js decorates).
 * @param {string} slug e.g. '' for index, or 'path/to/page'
 * @param {{ tags?: string[] }} [options] extra cache tags to attach alongside `page:<slug>`
 *   (e.g. `{ tags: ['catalog'] }` for the shared structured-content catalog pages)
 * @returns {Promise<string|null>} the raw .plain.html body, or null if the page doesn't exist (404)
 */
export async function fetchPlainHtml(slug = '', { tags = [] } = {}) {
  const path = slug ? `${slug}.plain.html` : 'index.plain.html';
  const res = await fetch(`${EDS_ORIGIN}/${path}`, {
    // ISR: cache and revalidate. Production would purge via a publish webhook + revalidateTag.
    next: { revalidate: 60, tags: [`page:${slug || 'index'}`, ...tags] },
  });
  // A missing page (or a non-page request like /favicon.ico) → let the caller 404, not 500.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`EDS fetch failed: ${res.status} for /${path}`);
  const html = await res.text();
  // Delivered markup uses relative asset URLs (./media_…) that must resolve against
  // the EDS origin, not the Next.js page URL.
  return html.replace(/(src|srcset)="\.\//g, `$1="${EDS_ORIGIN}/`);
}
```

- [ ] **Step 2: Edit `lib/eds/queryIndex.js`.** Change the `fetchQueryIndex` signature to accept a feed path and extra tags, updating its doc comment:

```js
/**
 * Fetch an entire EDS query-index feed and index it by normalized path.
 *
 * query-index feeds are paginated (offset/limit/total), so we page through to get every row —
 * a single request would only return one window once a feed outgrows the page size. Cached
 * with a plain time-based revalidate (ISR); pass `tags` to also attach cache tags for
 * on-demand revalidation. Returns an empty Map if the feed is missing or malformed, so callers
 * degrade gracefully.
 * @param {string} [feedPath] path to the feed, relative to EDS_ORIGIN (default: the site-wide
 *   `query-index.json`; pass e.g. `'menu/query-index.json'` for a scoped index)
 * @param {{ tags?: string[] }} [options]
 * @returns {Promise<Map<string, object>>}
 */
export async function fetchQueryIndex(feedPath = 'query-index.json', { tags = [] } = {}) {
  const map = new Map();
  try {
    const pageSize = 1000;
    let offset = 0;
    let total = Infinity;
    while (offset < total) {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(
        `${EDS_ORIGIN}/${feedPath}?offset=${offset}&limit=${pageSize}`,
        { next: { revalidate: 60, tags } },
      );
      if (!res.ok) break;
      // eslint-disable-next-line no-await-in-loop
      const json = await res.json();
      const rows = json.data ?? [];
      total = Number.isFinite(json.total) ? json.total : rows.length;
      rows.forEach((row) => {
        if (row?.path) map.set(normalizePath(row.path), row);
      });
      if (rows.length === 0) break; // guard against a bad total
      offset += rows.length;
    }
  } catch {
    // return whatever we collected (possibly empty)
  }
  return map;
}
```

- [ ] **Step 3: Regression-check the existing callers still work.** Start the dev server in the background and note the actual port it prints (this worktree has been observed binding a non-default port, e.g. 3319 — read the real one from the startup log, don't assume 3000):

```bash
npm run dev &
sleep 3
```

Then curl the home page and confirm it still returns 200 and contains the nav (proves `fetchQueryIndex()`/`fetchPlainHtml()` called with no extra args still behave identically):

```bash
curl -s -o /dev/null -w "home: %{http_code}\n" "http://localhost:<PORT>/"
curl -s "http://localhost:<PORT>/" | grep -qi "<header" && echo "nav present" || echo "NAV MISSING"
```

Expected: `home: 200` and `nav present`.

- [ ] **Step 4: Probe the new capability against the real (currently empty) catalog endpoints.** From the repo root, with network access:

```bash
node --input-type=module -e "
import { fetchQueryIndex } from './lib/eds/queryIndex.js';
import { fetchPlainHtml } from './lib/eds/fetch.js';
const menu = await fetchQueryIndex('menu/query-index.json', { tags: ['catalog'] });
console.log('menu feed size:', menu.size);
const html = await fetchPlainHtml('config/ingredients', { tags: ['catalog'] });
console.log('ingredients html:', html);
"
```

Expected output exactly: `menu feed size: 0` and `ingredients html: null` — both endpoints 404 today (confirmed earlier by direct `curl`), and both functions must return an empty/`null` result without throwing.

- [ ] **Step 5: Stop the dev server.**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 6: Run `npm run lint`** (baseline sanity check; it does not cover `lib/`, but must still pass).

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 7: Commit.**

```bash
git add lib/eds/fetch.js lib/eds/queryIndex.js
git commit -m "feat(catalog): generalize fetchPlainHtml/fetchQueryIndex for extra tags and feed paths

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `lib/catalog.js` — `getMenu()` and `getIngredients()`

**Files:**
- Create: `lib/catalog.js`
- Verify: a throwaway Node script exercising real parsing logic against fixture data (never committed) + a live network probe

**Interfaces:**
- Consumes: `fetchQueryIndex(feedPath, { tags })` and `fetchPlainHtml(slug, { tags })` from Task 1; `parseEds(html)` from the existing `lib/eds/parse.js` (returns `{ kind, styles, children }[]`; a block child has `{ kind: 'block', name, variants, rows, html }` where `rows` is `Cell[][]` and each `Cell` is `{ html, pictureOnly }`).
- Produces: `getMenu(): Promise<MenuItem[]>` where `MenuItem = { slug, path, name, description, image, priceCents, category, tags: string[], special: boolean }`. Produces: `getIngredients(): Promise<{ bread: Ingredient[], protein: Ingredient[], cheese: Ingredient[], veg: Ingredient[], sauce: Ingredient[], extra: Ingredient[] }>` where `Ingredient = { name, priceCents, default: boolean }`. Both are the exact shapes later tasks (and later phases' builder) will consume — do not rename these fields.

- [ ] **Step 1: Write `lib/catalog.js`** exactly:

```js
import { fetchQueryIndex } from './eds/queryIndex.js';
import { fetchPlainHtml } from './eds/fetch.js';
import { parseEds } from './eds/parse.js';

// Structured-content catalog: menu items (indexed pages under /menu/*) and the build-your-own
// ingredient palette (a single Ingredients block on /config/ingredients). See
// docs/content-schema.md for the authored schema. Both fetches share a 'catalog' cache tag so
// /api/revalidate can bust them together when either publishes. Invalid/incomplete authored
// rows are dropped rather than surfaced broken — the catalog degrades gracefully, it never
// throws or 500s a page.

const CATALOG_TAGS = ['catalog'];
const CATEGORIES = ['signature', 'classic', 'veg', 'seasonal'];
const INGREDIENT_TYPES = ['bread', 'protein', 'cheese', 'veg', 'sauce', 'extra'];

/**
 * @typedef {{ slug: string, path: string, name: string, description: string, image: string,
 *   priceCents: number, category: string, tags: string[], special: boolean }} MenuItem
 * @typedef {{ name: string, priceCents: number, default: boolean }} Ingredient
 */

/** Parse a decimal USD price string ("11", "8.50") to integer cents, or null if invalid. */
function toCents(raw) {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/**
 * Fetch and validate the authored menu feed (/menu/query-index.json).
 * @returns {Promise<MenuItem[]>}
 */
export async function getMenu() {
  const rows = await fetchQueryIndex('menu/query-index.json', { tags: CATALOG_TAGS });
  const items = [];
  rows.forEach((row, path) => {
    const priceCents = toCents(row.price);
    // name, image, and a valid price are the only hard requirements (see content-schema.md
    // "App validation") — everything else has a safe default.
    if (!row.name || !row.image || priceCents === null) return;
    const category = CATEGORIES.includes(row.category) ? row.category : 'signature';
    const tags = (row.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
    items.push({
      slug: path.replace(/^\/menu\//, ''),
      path,
      name: row.name,
      description: row.description || '',
      image: row.image,
      priceCents,
      category,
      tags,
      special: row.special === 'true',
    });
  });
  return items;
}

/** Strip tags and collapse whitespace to get a table cell's plain text. */
function cellText(cell) {
  if (!cell) return '';
  return cell.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Fetch and parse the authored Ingredients block (/config/ingredients) into a palette grouped
 * by type. Returns an empty palette (never throws) when the page or block doesn't exist yet.
 * @returns {Promise<Record<'bread'|'protein'|'cheese'|'veg'|'sauce'|'extra', Ingredient[]>>}
 */
export async function getIngredients() {
  const palette = { bread: [], protein: [], cheese: [], veg: [], sauce: [], extra: [] };
  const html = await fetchPlainHtml('config/ingredients', { tags: CATALOG_TAGS });
  if (!html) return palette;

  const block = parseEds(html)
    .flatMap((section) => section.children)
    .find((node) => node.kind === 'block' && node.name === 'ingredients');
  if (!block) return palette;

  block.rows.forEach((row) => {
    const type = cellText(row[0]).toLowerCase();
    const name = cellText(row[1]);
    const priceCents = toCents(cellText(row[2]));
    if (!INGREDIENT_TYPES.includes(type) || !name || priceCents === null) return;
    palette[type].push({
      name,
      priceCents,
      default: cellText(row[3]).toLowerCase() === 'true',
    });
  });

  return palette;
}
```

- [ ] **Step 2: Verify the parsing/coercion logic against realistic fixtures.** This repo has no test runner and no mocking library — verify by monkey-patching `globalThis.fetch` in a throwaway script (do not commit it) so the real `getMenu()`/`getIngredients()` code runs against canned responses, including one deliberately invalid menu row to prove it's dropped:

```bash
node --input-type=module -e "
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('menu/query-index.json')) {
    return new Response(JSON.stringify({
      total: 2, offset: 0, limit: 1000,
      data: [
        { path: '/menu/italian-stack', name: 'The Italian Stack', description: 'Salami, capicola, provolone, hot peppers on ciabatta.', image: 'https://example.com/italian.jpg', price: '11', category: 'signature', tags: 'spicy, pork', special: 'true' },
        { path: '/menu/bad-row', name: '', description: '', image: '', price: 'oops', category: 'nope' },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.includes('config/ingredients.plain.html')) {
    return new Response('<div class=\"ingredients\"><div><div>bread</div><div>Ciabatta</div><div>8.50</div><div>true</div></div><div><div>protein</div><div>Turkey</div><div>0</div><div>true</div></div><div><div>nonsense</div><div>x</div><div>1</div><div></div></div></div>', { status: 200 });
  }
  return new Response(null, { status: 404 });
};
const { getMenu, getIngredients } = await import('./lib/catalog.js');
const menu = await getMenu();
console.log('menu items:', menu.length);
console.log(JSON.stringify(menu[0]));
const ing = await getIngredients();
console.log('bread:', JSON.stringify(ing.bread));
console.log('protein:', JSON.stringify(ing.protein));
console.log('cheese (should be empty):', JSON.stringify(ing.cheese));
"
```

Expected output exactly:
- `menu items: 1` (the `bad-row` entry is dropped — missing name/image and an unparseable price)
- the printed item has `"slug":"italian-stack"`, `"priceCents":1100`, `"category":"signature"`, `"tags":["spicy","pork"]`, `"special":true`
- `bread: [{"name":"Ciabatta","priceCents":850,"default":true}]`
- `protein: [{"name":"Turkey","priceCents":0,"default":true}]`
- `cheese (should be empty): []` (the "nonsense"-typed row is dropped)

- [ ] **Step 3: Probe against the real (currently empty) origin** to confirm the live path also degrades gracefully:

```bash
node --input-type=module -e "
const { getMenu, getIngredients } = await import('./lib/catalog.js');
console.log('live menu:', (await getMenu()).length);
console.log('live ingredients bread:', (await getIngredients()).bread.length);
"
```

Expected: `live menu: 0` and `live ingredients bread: 0` — no throw.

- [ ] **Step 4: Run `npm run lint`.**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 5: Commit.**

```bash
git add lib/catalog.js
git commit -m "feat(catalog): add lib/catalog.js — getMenu() and getIngredients()

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: The `/menu` route

**Files:**
- Create: `app/(site)/menu/page.js`, `app/(site)/menu/MenuCard.jsx`, `app/(site)/menu/menu.css`
- Modify: `package.json` (widen `lint:css`'s glob)
- Verify: `npm run lint`, dev server + curl + browser (empty-state today; the route itself resolving over the catch-all)

**Interfaces:**
- Consumes: `getMenu()` from Task 2 (`MenuItem[]`, fields as defined there).
- Produces: `MenuCard({ item: MenuItem })` — a default-exported Server Component, reusable by Task 4's `MenuHighlight`. Produces the route `GET /menu`.

- [ ] **Step 1: Widen the CSS lint glob in `package.json`.** This is the first CSS to live under `app/`; add it to the existing `lint:css` script (do not touch `lint:js` — `app/`'s JS/JSX stays excluded per the existing `.eslintignore`, which this task does not change):

```json
    "lint:css": "stylelint \"blocks/**/*.css\" \"styles/*.css\" \"app/**/*.css\"",
```

- [ ] **Step 2: Write `app/(site)/menu/menu.css`:**

```css
/* Stacked — /menu route styles. Card + page layout, following the blocks/ convention of a
   component owning its own stylesheet (imported directly by MenuCard.jsx and page.js), even
   though this isn't an EDS block. Brand tokens only — see docs/DESIGN.md. */

.menu-page h1 {
  margin-bottom: var(--space-m);
}

.menu-empty {
  color: var(--text-muted);
}

.menu-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-m);
}

@media (width >= 600px) {
  .menu-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (width >= 900px) {
  .menu-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.menu-card {
  display: flex;
  flex-direction: column;
  background: var(--surface-card);
  border-radius: var(--radius-brick);
  box-shadow: var(--shadow-brick);
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  transition: transform var(--duration-snap) var(--ease-snap),
              box-shadow var(--duration-snap) var(--ease-snap);
}

.menu-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-pop);
  text-decoration: none;
}

.menu-card-media {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--surface-tint);
}

.menu-card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.menu-card-badge {
  position: absolute;
  top: var(--space-xs);
  left: var(--space-xs);
  background: var(--brand-sun);
  color: var(--on-sun);
  font-size: var(--body-font-size-xs);
  font-weight: var(--weight-medium);
  padding: 0.2em 0.7em;
  border-radius: var(--radius-pill);
}

.menu-card-body {
  padding: var(--space-s) var(--space-m);
}

.menu-card-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-xs);
}

.menu-card-name {
  margin: 0;
  font-family: var(--heading-font-family);
  font-size: var(--heading-font-size-m);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  line-height: var(--leading-heading);
}

.menu-card-price {
  font-family: var(--heading-font-family);
  font-size: var(--heading-font-size-m);
  font-weight: var(--weight-bold);
  white-space: nowrap;
}

.menu-card-description {
  margin: var(--space-2xs) 0 0;
  color: var(--text-muted);
  font-size: var(--body-font-size-s);
  line-height: var(--leading-body);
}
```

- [ ] **Step 3: Write `app/(site)/menu/MenuCard.jsx`:**

```jsx
import Link from 'next/link';
import './menu.css';

// Presentational card for one authored menu item. Server Component — no client JS. Links to
// the item's own content page (/menu/<slug>), rendered by the [[...slug]] catch-all.
export default function MenuCard({ item }) {
  const price = (item.priceCents / 100).toFixed(2);
  return (
    <Link href={`/menu/${item.slug}`} className="menu-card">
      <div className="menu-card-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt={item.name} loading="lazy" />
        {item.special && <span className="menu-card-badge">Special</span>}
      </div>
      <div className="menu-card-body">
        <div className="menu-card-row">
          <h3 className="menu-card-name">{item.name}</h3>
          <span className="menu-card-price">${price}</span>
        </div>
        <p className="menu-card-description">{item.description}</p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Write `app/(site)/menu/page.js`:**

```jsx
import { getMenu } from '../../../lib/catalog.js';
import MenuCard from './MenuCard.jsx';
import './menu.css';

export const metadata = {
  title: 'Menu — Stacked',
  description: 'Shop the menu or build your own sandwich, brick by brick.',
};

// Explicit route: /menu wins over the [[...slug]] catch-all for this literal path. Reads the
// authored catalog (menu/query-index.json) directly — this is app UI, not EDS content.
export default async function MenuPage() {
  const items = await getMenu();

  return (
    <main>
      <div className="section">
        <div className="menu-page">
          <h1>Menu</h1>
          {items.length === 0 ? (
            <p className="menu-empty">No sandwiches on the menu yet — check back soon.</p>
          ) : (
            <div className="menu-grid">
              {items.map((item) => <MenuCard key={item.slug} item={item} />)}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run `npm run lint`** (now covers the new CSS via the widened glob).

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 6: Verify `/menu` resolves to the new route (not the catch-all), and renders today's honest empty state.** Start the dev server and read its real port from the startup log:

```bash
npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:<PORT>/menu"
curl -s "http://localhost:<PORT>/menu"
```

Expected: `200`, and the body contains `<h1>Menu</h1>` and the exact text `No sandwiches on the menu yet — check back soon.` (proving the catalog is empty today and the page handles it, rather than throwing or 404ing).

- [ ] **Step 7: Browser check for visual correctness of the empty state.** Using the Browser tool, open `http://localhost:<PORT>/menu` and confirm the page renders the site header/nav (proving it inherited the `(site)` layout) and the "Menu" heading in Bricolage Grotesque, with no console errors.

- [ ] **Step 8: Stop the dev server.**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 9: Commit.**

```bash
git add "app/(site)/menu" package.json
git commit -m "feat(menu): add the /menu route (MenuCard, empty-state handling)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Home page menu highlight

**Files:**
- Create: `app/(site)/menu/MenuHighlight.jsx`, `app/(site)/menu/menu-highlight.css`
- Modify: `app/(site)/[[...slug]]/page.js`
- Verify: `npm run lint`, dev server + curl + browser

**Interfaces:**
- Consumes: `getMenu()` from Task 2; `MenuCard` (default export, `{ item: MenuItem }` prop) from Task 3.
- Produces: `MenuHighlight({ items: MenuItem[] })` — a default-exported Server Component.

- [ ] **Step 1: Write `app/(site)/menu/menu-highlight.css`:**

```css
/* Stacked — home page "today's picks" strip (MenuHighlight). Reuses .menu-card styles from
   menu.css; only the section/grid wrapper is defined here. */

.menu-highlight h2 {
  margin-bottom: var(--space-m);
}

.menu-highlight-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-m);
}

@media (width >= 600px) {
  .menu-highlight-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

- [ ] **Step 2: Write `app/(site)/menu/MenuHighlight.jsx`:**

```jsx
import MenuCard from './MenuCard.jsx';
import './menu-highlight.css';

const HIGHLIGHT_COUNT = 3;

// Server-rendered "today's picks" strip for the home page: the authored menu's special items
// (or, absent any, its first few), read straight from the catalog — not authored EDS content.
// Renders nothing when the catalog is empty (no sandwiches authored yet).
export default function MenuHighlight({ items }) {
  if (!items.length) return null;
  const picks = items.filter((item) => item.special).slice(0, HIGHLIGHT_COUNT);
  const shown = picks.length ? picks : items.slice(0, HIGHLIGHT_COUNT);

  return (
    <div className="section">
      <div className="menu-highlight">
        <h2>Today&rsquo;s picks</h2>
        <div className="menu-highlight-grid">
          {shown.map((item) => <MenuCard key={item.slug} item={item} />)}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire it into the home page.** Open `app/(site)/[[...slug]]/page.js`. Add two imports alongside the existing ones:

```js
import { getMenu } from '../../../lib/catalog.js';
import MenuHighlight from '../menu/MenuHighlight.jsx';
```

Then replace the `Page` function's body with a version that fetches the menu only for the home path and renders the highlight after the authored sections (placed last, after all authored content, so it never displaces a page's own hero/lead content — this is a deliberate simplification for this phase, not an oversight):

```jsx
export default async function Page({ params }) {
  const { slug } = await params;
  const path = (slug ?? []).join('/');

  const html = await fetchPlainHtml(path);
  if (html === null) notFound(); // missing page / non-page request → 404, not 500

  const tree = parseEds(html);
  const highlight = path === '' ? await getMenu() : null;

  return (
    <main>
      {tree.map((node, i) => renderNode(node, i))}
      {highlight && <MenuHighlight items={highlight} />}
    </main>
  );
}
```

Leave `generateMetadata` and `generateStaticParams` above it untouched.

- [ ] **Step 4: Run `npm run lint`.**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 5: Verify the home page still renders and the highlight behaves.** Start the dev server, read the real port:

```bash
npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:<PORT>/"
curl -s "http://localhost:<PORT>/" | grep -c "menu-highlight" || true
```

Expected: `200`. Today the catalog is empty, so `MenuHighlight` returns `null` and `menu-highlight` should appear **0** times in the body — confirming the empty-catalog case cleanly renders nothing rather than an empty shell. Also confirm a non-home page (any other real authored path, or `/menu`) still returns 200 and does **not** contain `menu-highlight` (proving the `path === ''` gate works).

- [ ] **Step 6: Browser check.** Open the home page in the Browser tool and confirm it renders exactly as it did before this task (no visible change today, since the catalog is empty) and there are no console errors.

- [ ] **Step 7: Stop the dev server.**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 8: Commit.**

```bash
git add "app/(site)/menu/MenuHighlight.jsx" "app/(site)/menu/menu-highlight.css" "app/(site)/[[...slug]]/page.js"
git commit -m "feat(menu): add a home-page menu highlight strip

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Bust the `catalog` tag on publish

**Files:**
- Modify: `app/api/revalidate/route.js`
- Verify: dev server + curl (three cases: a normal page, the ingredients page, a menu item)

**Interfaces:**
- Produces: `POST /api/revalidate` now also calls `revalidateTag('catalog')`, and its JSON response's `revalidated` field changes from a single string to an array of the tags it busted, whenever the slug is `config/ingredients` or starts with `menu/`. (Confirmed non-breaking: the only consumer, `.github/workflows/revalidate.yaml`, only checks the HTTP status code and never parses the response body.)

- [ ] **Step 1: Edit `app/api/revalidate/route.js`.** Replace the body of the `POST` handler (keep the `slug` look-up above it — the query-param-then-body fallback — unchanged) with:

```js
export async function POST(request) {
  // Prefer the slug from the query string (simple cross-origin POST, no preflight); fall back
  // to a JSON body for server callers.
  let slug = new URL(request.url).searchParams.get('slug') ?? '';
  if (!slug) {
    try {
      ({ slug = '' } = await request.json());
    } catch {
      // no/invalid body — treat as the index
    }
  }

  const normalized = slug.replace(/^\/+|\/+$/g, '');
  const tag = `page:${normalized || 'index'}`;
  revalidateTag(tag);

  // The catalog (menu items + the ingredients block) is cached under its own tag so both
  // /menu and the builder pick up a publish without waiting for their own ISR window.
  const tags = [tag];
  if (normalized === 'config/ingredients' || normalized.startsWith('menu/')) {
    revalidateTag('catalog');
    tags.push('catalog');
  }

  return NextResponse.json({ ok: true, revalidated: tags, now: Date.now() }, { headers: CORS });
}
```

- [ ] **Step 2: Run `npm run lint`.**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 3: Verify all three cases.** Start the dev server, read the real port:

```bash
npm run dev &
sleep 3
curl -s -X POST "http://localhost:<PORT>/api/revalidate?slug=getting-started"
echo ""
curl -s -X POST "http://localhost:<PORT>/api/revalidate?slug=config/ingredients"
echo ""
curl -s -X POST "http://localhost:<PORT>/api/revalidate?slug=menu/italian-stack"
```

Expected JSON bodies (field order may vary, `now` will differ):
- `{"ok":true,"revalidated":["page:getting-started"],"now":...}`
- `{"ok":true,"revalidated":["page:config/ingredients","catalog"],"now":...}`
- `{"ok":true,"revalidated":["page:menu/italian-stack","catalog"],"now":...}`

- [ ] **Step 4: Stop the dev server.**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 5: Commit.**

```bash
git add app/api/revalidate/route.js
git commit -m "feat(catalog): bust the catalog tag when a menu item or ingredients page publishes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Prepare authoring-ready sample content

This task produces **local files only** — it does not publish anything to the real EDS/DA content source, and does not use any content-authoring tool. It ends by asking the user for help, per this project's own established process for exactly this situation (`AGENTS.md`: "If no authored content exists to test against, you can create static HTML files ... and ask the user for help copying it to a cms content page").

**Files:**
- Create: `content-samples/menu/italian-stack.md`, `content-samples/menu/cubano.md`, `content-samples/menu/caprese.md`, `content-samples/config/ingredients.md`
- Verify: the files match the schema in `docs/content-schema.md`; no code changes, so no lint/dev-server step applies

**Interfaces:** None — this task produces content deliverables consumed by a human, not code consumed by later tasks.

- [ ] **Step 1: Write `content-samples/menu/italian-stack.md`:**

```markdown
# The Italian Stack

Salami, capicola, provolone, hot peppers on ciabatta.

| Metadata |             |
| -------- | ----------- |
| price    | 11          |
| category | signature   |
| tags     | spicy, pork |
| special  | true        |

Author notes: create this as a page at `/menu/italian-stack` in DA, add a real photo of the
sandwich via the image picker (the `image` field is read from that photo automatically — no
separate metadata row needed for it), then Preview and Publish.
```

- [ ] **Step 2: Write `content-samples/menu/cubano.md`:**

```markdown
# The Cubano

Roast pork, ham, Swiss, pickles, mustard, pressed.

| Metadata |         |
| -------- | ------- |
| price    | 12      |
| category | classic |

Author notes: create this as a page at `/menu/cubano` in DA, add a real photo, Preview and
Publish.
```

- [ ] **Step 3: Write `content-samples/menu/caprese.md`:**

```markdown
# Caprese

Fresh mozzarella, tomato, basil, balsamic on ciabatta.

| Metadata |          |
| -------- | -------- |
| price    | 9        |
| category | veg      |
| tags     | vegetarian |

Author notes: create this as a page at `/menu/caprese` in DA, add a real photo, Preview and
Publish.
```

- [ ] **Step 4: Write `content-samples/config/ingredients.md`** (the build-your-own palette — a single block, one row per ingredient; `bread` rows set the build's base price, every other type is an additive upcharge, `0` means included):

```markdown
# Build your own

| Ingredients |            |      |      |
| ----------- | ---------- | ---- | ---- |
| bread       | Ciabatta   | 8.50 | true |
| bread       | Sourdough  | 8.50 |      |
| protein     | Turkey     | 0    | true |
| protein     | Bacon      | 2    |      |
| cheese      | Provolone  | 1    |      |
| veg         | Lettuce    | 0    | true |
| veg         | Tomato     | 0    | true |
| sauce       | Pesto mayo | 0    | true |
| extra       | Avocado    | 1.50 |      |

Author notes: create this as a page at `/config/ingredients` in DA, using an actual table block
named "Ingredients" (first row is the block name, each following row is one ingredient: type,
name, price, default) — not a rendered markdown table. Preview and Publish; no photo needed.
```

- [ ] **Step 5: Confirm each file matches `docs/content-schema.md`'s field/column definitions** (re-read the file after writing and check every value against the schema's tables — category values are all from `signature|classic|veg|seasonal`, ingredient types are all from `bread|protein|cheese|veg|sauce|extra`, prices are plain decimal strings).

- [ ] **Step 6: Commit the local files** (still not published to DA — this is just committing the prepared deliverable to the repo):

```bash
git add content-samples
git commit -m "docs(catalog): prepare sample menu + ingredients content for authoring

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 7: Ask the user for help.** Report back (do not proceed further) with a message equivalent to: "I've prepared sample catalog content at `content-samples/menu/*.md` and `content-samples/config/ingredients.md`, matching the schema in `docs/content-schema.md`. Could you (or an author on the team) help get equivalent pages created in DA at `content.da.live/AdobeDevXSC/next-eds/` — three pages under `/menu/` (each with a real photo) and one at `/config/ingredients` (an `Ingredients` block table) — then Preview and Publish them? Once they're live, the `/menu` route and the home page highlight (built in this phase) will show real content instead of the empty state."

---

## Phase 1 acceptance

- `getMenu()`/`getIngredients()` correctly parse and validate realistic fixture data (proven in Task 2), and gracefully return empty results against the real, not-yet-authored origin.
- `/menu` resolves to the new explicit route (not the catch-all) and renders an honest empty state today.
- The home page renders a highlight strip only when the catalog has content; today it renders nothing extra.
- Publishing a menu item or the ingredients page (once authored) will bust the shared `catalog` cache tag via `/api/revalidate`.
- Sample content ready for a human author to publish is prepared and committed; the user has been asked for help getting it live.
- `npm run lint` is green throughout (including the widened `lint:css` glob covering the new `app/**/*.css`).

## Not in this phase (next up)

- Phase 2 — Builder: the build-your-own configurator ("The Stack") consuming `getIngredients()`, with a live running price. See the [demo spec](../specs/2026-08-13-stacked-demo-design.md) §11.
