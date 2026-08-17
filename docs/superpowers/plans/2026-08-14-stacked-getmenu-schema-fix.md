# getMenu() Real-Content Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `getMenu()` so it correctly reads the 6 real menu items now authored in DA. The already-shipped Phase 1 implementation assumed menu items would carry their fields (`price`, `category`, `tags`, `special`) as page `<meta>` tags (the classic EDS Metadata-block convention); the real content instead uses DA's newer **schema** authoring feature (`x-schema-name: menu-item`), which renders every field into a body block (`<div class="menu-item">`) and never touches `<meta>` tags at all. Confirmed by fetching the real delivered `.plain.html` for all 6 items directly.

**Architecture:** Keep the scoped `/menu/query-index.json` feed for cheap path discovery only (drop its meta-tag-based custom properties — they can never populate for this content). For each discovered path, fetch the page and parse its `menu-item` block directly — the same technique `getIngredients()` already uses for the `Ingredients` block, generalized from a fixed-column row shape to a flat `label → value` field map (each row is `<h3>label</h3>` + a value cell, not four fixed columns). A shared, entity-decoding-safe `cellText()` replaces the current tag-strip-only version, fixing a real bug found in the live data (`Roasted Turkey &amp; Swiss` must decode to `Roasted Turkey & Swiss`).

**Tech Stack:** Same as the rest of `lib/catalog.js` — plain ES6 modules, `node-html-parser` via the existing `lib/eds/parse.js`, no new dependencies.

## Global Constraints

- The real, live field data for all 6 authored items (confirmed today via direct fetch) is the ground truth for every verification step in this plan:

  | slug | name | description | price | category | tags | special |
  |---|---|---|---|---|---|---|
  | `italian-stack` | The Italian Stack | Salami, capicola, and provolone piled with hot peppers on toasted ciabatta. | 11 | signature | spicy, pork | false |
  | `autumn-harvest-stack` | Autumn Harvest Stack | This week's feature: roasted turkey, provolone, and a maple-pepper glaze. | 11.5 | seasonal | seasonal, roasted, turkey | true |
  | `garden-veg-stack` | Garden Veg Stack | Avocado, provolone, lettuce, and pesto mayo on sourdough. | 9 | veg | vegetarian, fresh | false |
  | `roasted-turkey-swiss` | Roasted Turkey & Swiss | Roasted turkey and melted Swiss with lettuce on ciabatta. | 9.5 | classic | turkey | false |
  | `smoky-brisket-stack` | Smoky Brisket Stack | Slow-smoked brisket, pickles, and pesto mayo on ciabatta. | 12.5 | signature | smoky, beef | false |
  | `turkey-club-stack` | Turkey Club Stack | Roasted turkey, crisp bacon, lettuce, and tomato on toasted sourdough. | 10 | classic | turkey, bacon | false |

  Note the `&amp;` in `roasted-turkey-swiss`'s name — the one entity-decoding case this plan must get right.

- `menu/test.html` also exists in DA with placeholder field values (`name` field literally contains the text `"name"`, `image` contains `"example image"`) — leftover scaffold from setting up the schema, not a real menu item. It would otherwise pass the existing hard-requirement checks (non-empty `name`/`image`, a parseable `price`). This plan adds a narrow, explicitly-commented defensive skip for this one known slug; the user has separately been told to delete `menu/test.html` from DA as the real fix.
- **A real infrastructure gap this plan cannot close by itself:** the scoped `menu` index in `helix-query.yaml` lives on an unmerged feature branch — the live EDS origin (which tracks `main`) has never seen it, so `/menu/query-index.json` 404s today regardless of this fix's correctness. This plan's own live verification therefore fetches each real page directly (bypassing the index) to prove the field-extraction logic; the index-based discovery path is verified against realistic fixtures instead, and is disclosed as unprovable end-to-end until this branch merges (and possibly needs an explicit reindex afterward).
- `lib/` is not covered by `npm run lint:js` (pre-existing `.eslintignore` exclusion) — write clean code matching the existing file's style, but the linter won't catch mistakes here; the fixture scripts and live fetches are the real verification.
- No unit-test runner exists. Verification is `npm run lint`, fixture-fed Node scripts (Node 22 — `~/.nvm/versions/node/v22.16.0/bin/node` — for the same ESM/CJS reason as every prior phase), and live fetches against the real, already-published pages.
- `MenuItem`'s shape (`slug, path, name, description, image, priceCents, category, tags, special`) must not change — `/menu`, `MenuCard`, and `MenuHighlight` (already shipped) all depend on these exact field names.
- Unix (LF) line endings; ES6+ with `.js` import extensions.

## File Structure

- `helix-query.yaml` — modify. Drop the `menu` index's meta-tag-based custom properties (`name`/`description`/`image`/`price`/`category`/`tags`/`special`); keep only `lastModified`.
- `lib/catalog.js` — modify. Rewrite `getMenu()` to discover paths via the (now path-only) scoped index and extract real fields by parsing each page's `menu-item` block. Fix `cellText()` to decode HTML entities, and share it between `getMenu()` and `getIngredients()`.
- `docs/content-schema.md` — modify. Rewrite the "Menu item" section to describe the real DA schema-block convention instead of the Metadata-table/meta-tag convention it currently (incorrectly) describes.

---

### Task 1: Simplify the `menu` index in `helix-query.yaml`

**Files:**
- Modify: `helix-query.yaml`
- Verify: YAML parses; the default index and its properties are untouched

**Interfaces:**
- Produces: the `menu` index still targets `/menu/query-index.json` and still includes `/menu/**`, but its only declared property is `lastModified`. `path` is always present on every row regardless of declared properties (confirmed by every existing index in this file already returning `path`).

- [ ] **Step 1: Edit `helix-query.yaml`.** Replace the `menu` index block (everything from `menu:` to the end of the file) with:

```yaml
  # Scoped catalog index for menu items authored as content pages under /menu/*. Used only for
  # path discovery + lastModified — menu items are authored via DA's schema feature
  # (x-schema-name: menu-item), which renders fields into a body block, not page <meta> tags,
  # so no custom meta-based properties are declared here. lib/catalog.js's getMenu() reads the
  # real fields by parsing each page's menu-item block directly. See docs/content-schema.md.
  menu:
    include:
      - '/menu/**'
    target: /menu/query-index.json
    properties:
      lastModified:
        select: none
        value: parseTimestamp(headers('last-modified'), 'ddd, DD MMM YYYY hh:mm:ss GMT')
```

- [ ] **Step 2: Verify the YAML still parses and the default index is untouched:**

```bash
node -e "const fs=require('fs');const y=require('yaml');const d=y.parse(fs.readFileSync('helix-query.yaml','utf8'));console.log('indices:',Object.keys(d.indices));console.log('menu props:',Object.keys(d.indices.menu.properties));console.log('default props unchanged:',Object.keys(d.indices.default.properties).join(','));"
```

Expected: `indices: [ 'default', 'menu' ]`, `menu props: [ 'lastModified' ]`, and `default props unchanged: title,description,image,robots,lastModified`.

- [ ] **Step 3: Commit.**

```bash
git add helix-query.yaml
git commit -m "fix(catalog): drop unusable meta-based properties from the menu index

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Rewrite `getMenu()` to read the real `menu-item` schema block

**Files:**
- Modify: `lib/catalog.js`
- Verify: a fixture-fed Node script (discovery + extraction wiring) and a live fetch against all 6 real, already-published pages

**Interfaces:**
- Consumes: `fetchQueryIndex('menu/query-index.json', { tags })` (Task 1's simplified index — rows now have only `path`/`lastModified`); `fetchPlainHtml(slug, { tags })`; `parseEds(html)` (all pre-existing, unchanged).
- Produces: `getMenu(): Promise<MenuItem[]>` — same shape as before (`slug, path, name, description, image, priceCents, category, tags, special`). `getIngredients()`'s public behavior and return shape are unchanged; only its internal `cellText` now also decodes entities.

- [ ] **Step 1: Replace `lib/catalog.js` in full** with:

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
const MENU_ITEM_BLOCK = 'menu-item';
// Known DA schema-scaffold artifact (placeholder field values) left over from setting up the
// menu-item schema — not a real item. The real fix is deleting menu/test.html in DA; this is a
// narrow, disclosed safety net so a demo never shows it in the meantime.
const IGNORED_MENU_SLUGS = new Set(['test']);

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

/** Decode the small set of named entities real authored copy is likely to contain (e.g.
 * "Turkey &amp; Swiss"). A full HTML-entity table isn't worth a dependency for this. */
function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'");
}

/** Strip tags, decode entities, and collapse whitespace to get a table cell's plain text. */
function cellText(cell) {
  if (!cell) return '';
  return decodeEntities(cell.html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Read a DA schema block (e.g. the menu-item block) as a flat label -> value field map. Each
 * row is a [label, value] pair (`<h3>label</h3>` + a value cell) rather than Ingredients' fixed
 * four-column layout. */
function readFieldBlock(block) {
  const fields = {};
  block.rows.forEach((row) => {
    const key = cellText(row[0]);
    if (key) fields[key] = cellText(row[1]);
  });
  return fields;
}

/**
 * Fetch the real menu-item fields for one page by parsing its authored menu-item block
 * directly (menu items are authored via DA's schema feature, which renders fields into a body
 * block, not page <meta> tags). Returns null (never throws) for a missing page, a page with no
 * menu-item block, or one missing a hard-required field.
 * @param {string} slug
 * @returns {Promise<MenuItem|null>}
 */
async function fetchMenuItem(slug) {
  let html;
  try {
    html = await fetchPlainHtml(`menu/${slug}`, { tags: CATALOG_TAGS });
  } catch {
    return null;
  }
  if (!html) return null;

  const block = parseEds(html)
    .flatMap((section) => section.children)
    .find((node) => node.kind === 'block' && node.name === MENU_ITEM_BLOCK);
  if (!block) return null;

  const fields = readFieldBlock(block);
  const priceCents = toCents(fields.price);
  // name, image, and a valid price are the only hard requirements (see content-schema.md
  // "App validation") — everything else has a safe default.
  if (!fields.name || !fields.image || priceCents === null) return null;

  const category = CATEGORIES.includes(fields.category) ? fields.category : 'signature';
  const tags = (fields.tags || '').split(',').map((t) => t.trim()).filter(Boolean);

  return {
    slug,
    path: `/menu/${slug}`,
    name: fields.name,
    description: fields.description || '',
    image: fields.image,
    priceCents,
    category,
    tags,
    special: fields.special === 'true',
  };
}

/**
 * Fetch every authored menu item. Discovers paths from the scoped /menu/query-index.json feed
 * (path-only — see helix-query.yaml), then reads each page's real fields directly.
 * @returns {Promise<MenuItem[]>}
 */
export async function getMenu() {
  const feed = await fetchQueryIndex('menu/query-index.json', { tags: CATALOG_TAGS });
  const slugs = [...feed.keys()]
    .map((path) => path.replace(/^\/menu\//, ''))
    .filter((slug) => slug && !IGNORED_MENU_SLUGS.has(slug));

  const items = await Promise.all(slugs.map(fetchMenuItem));
  return items.filter(Boolean);
}

/**
 * Fetch and parse the authored Ingredients block (/config/ingredients) into a palette grouped
 * by type. Returns an empty palette (never throws) when the page or block doesn't exist yet.
 * @returns {Promise<Record<'bread'|'protein'|'cheese'|'veg'|'sauce'|'extra', Ingredient[]>>}
 */
export async function getIngredients() {
  const palette = { bread: [], protein: [], cheese: [], veg: [], sauce: [], extra: [] };
  let html;
  try {
    html = await fetchPlainHtml('config/ingredients', { tags: CATALOG_TAGS });
  } catch {
    // A non-404 origin error (5xx, network) — degrade to an empty palette, same as "not
    // authored yet"; the builder must never 500 a page over a transient origin problem.
    return palette;
  }
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

- [ ] **Step 2: Verify discovery + extraction wiring against a fixture** (Node 22, for the ESM/CJS reason established in every prior phase). This fixture uses the exact real `italian-stack` and `autumn-harvest-stack` field data captured live today, plus a `test` row (must be filtered) and a row with no `menu-item` block at all (must be dropped):

```bash
~/.nvm/versions/node/v22.16.0/bin/node --input-type=module -e "
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('menu/query-index.json')) {
    return new Response(JSON.stringify({
      total: 3, offset: 0, limit: 1000,
      data: [
        { path: '/menu/italian-stack' },
        { path: '/menu/autumn-harvest-stack' },
        { path: '/menu/test' },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.includes('menu/italian-stack.plain.html')) {
    return new Response('<div><div class=\"menu-item\"><div><div><h3>name</h3></div><div><p>The Italian Stack</p></div></div><div><div><h3>description</h3></div><div><p>Salami, capicola, and provolone piled with hot peppers on toasted ciabatta.</p></div></div><div><div><h3>image</h3></div><div><p>https://content.da.live/adobedevxsc/next-eds/menu/assets/italian-stack.svg</p></div></div><div><div><h3>price</h3></div><div><p>11</p></div></div><div><div><h3>category</h3></div><div><p>signature</p></div></div><div><div><h3>tags</h3></div><div><p>spicy, pork</p></div></div><div><div><h3>special</h3></div><div><p>false</p></div></div></div></div>', { status: 200 });
  }
  if (u.includes('menu/autumn-harvest-stack.plain.html')) {
    return new Response('<div><div class=\"menu-item\"><div><div><h3>name</h3></div><div><p>Autumn Harvest Stack</p></div></div><div><div><h3>description</h3></div><div><p>This week\'s feature.</p></div></div><div><div><h3>image</h3></div><div><p>https://content.da.live/adobedevxsc/next-eds/menu/assets/autumn-harvest-stack.svg</p></div></div><div><div><h3>price</h3></div><div><p>11.5</p></div></div><div><div><h3>category</h3></div><div><p>seasonal</p></div></div><div><div><h3>tags</h3></div><div><p>seasonal, roasted, turkey</p></div></div><div><div><h3>special</h3></div><div><p>true</p></div></div></div></div>', { status: 200 });
  }
  return new Response(null, { status: 404 });
};
const { getMenu } = await import('./lib/catalog.js');
const items = await getMenu();
console.log('count:', items.length);
console.log(JSON.stringify(items, null, 0));
"
```

Expected: `count: 2` (the `test` slug is filtered before ever being fetched), and the two items are:
`{"slug":"italian-stack","path":"/menu/italian-stack","name":"The Italian Stack","description":"Salami, capicola, and provolone piled with hot peppers on toasted ciabatta.","image":"https://content.da.live/adobedevxsc/next-eds/menu/assets/italian-stack.svg","priceCents":1100,"category":"signature","tags":["spicy","pork"],"special":false}`
`{"slug":"autumn-harvest-stack","path":"/menu/autumn-harvest-stack","name":"Autumn Harvest Stack","description":"This week's feature.","image":"https://content.da.live/adobedevxsc/next-eds/menu/assets/autumn-harvest-stack.svg","priceCents":1150,"category":"seasonal","tags":["seasonal","roasted","turkey"],"special":true}`

- [ ] **Step 3: Verify entity decoding specifically**, since it's the one real bug this task fixes:

```bash
~/.nvm/versions/node/v22.16.0/bin/node --input-type=module -e "
globalThis.fetch = async (url) => {
  const u = String(url);
  if (u.includes('menu/query-index.json')) {
    return new Response(JSON.stringify({ total: 1, offset: 0, limit: 1000, data: [{ path: '/menu/roasted-turkey-swiss' }] }), { status: 200 });
  }
  if (u.includes('roasted-turkey-swiss.plain.html')) {
    return new Response('<div><div class=\"menu-item\"><div><div><h3>name</h3></div><div><p>Roasted Turkey &amp; Swiss</p></div></div><div><div><h3>description</h3></div><div><p>Roasted turkey and melted Swiss with lettuce on ciabatta.</p></div></div><div><div><h3>image</h3></div><div><p>https://content.da.live/adobedevxsc/next-eds/menu/assets/roasted-turkey-swiss.svg</p></div></div><div><div><h3>price</h3></div><div><p>9.5</p></div></div><div><div><h3>category</h3></div><div><p>classic</p></div></div><div><div><h3>tags</h3></div><div><p>turkey</p></div></div><div><div><h3>special</h3></div><div><p>false</p></div></div></div></div>', { status: 200 });
  }
  return new Response(null, { status: 404 });
};
const { getMenu } = await import('./lib/catalog.js');
console.log((await getMenu())[0].name);
"
```

Expected: `Roasted Turkey & Swiss` (the `&amp;` is decoded — this is the exact bug this task fixes; before this task's `cellText` change, this printed `Roasted Turkey &amp; Swiss`).

- [ ] **Step 4: Live-verify field extraction against all 6 real, already-published pages** (bypasses the index — this fetches each real page directly, since the index itself can't be live-tested until this branch merges):

```bash
~/.nvm/versions/node/v22.16.0/bin/node --input-type=module -e "
process.env.EDS_ORIGIN = 'https://main--next-eds--AdobeDevXSC.aem.page';
const { fetchPlainHtml } = await import('./lib/eds/fetch.js');
const { parseEds } = await import('./lib/eds/parse.js');
const slugs = ['italian-stack','autumn-harvest-stack','garden-veg-stack','roasted-turkey-swiss','smoky-brisket-stack','turkey-club-stack'];
for (const slug of slugs) {
  const html = await fetchPlainHtml('menu/' + slug);
  const block = parseEds(html).flatMap((s) => s.children).find((n) => n.kind === 'block' && n.name === 'menu-item');
  console.log(slug, '-> block found:', !!block);
}
"
```

Expected: `-> block found: true` for all 6 slugs (this proves the real pages parse into a `menu-item` block exactly as this task's code expects; `getMenu()`'s own index-dependent discovery step can't run yet, so this checks the extraction half directly against production content).

Then run the real thing against production, confirming today's actual result:

```bash
~/.nvm/versions/node/v22.16.0/bin/node --input-type=module -e "
process.env.EDS_ORIGIN = 'https://main--next-eds--AdobeDevXSC.aem.page';
const { getMenu } = await import('./lib/catalog.js');
console.log('getMenu() count today:', (await getMenu()).length);
"
```

Expected: `getMenu() count today: 0` — **not a bug**. `/menu/query-index.json` still 404s because Task 1's simplified `menu` index lives on this unmerged branch; the live origin (tracking `main`) has never seen it. This is the disclosed, unavoidable gap noted in Global Constraints — record it as such, don't try to work around it.

- [ ] **Step 5: Run `npm run lint`.**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 6: Commit.**

```bash
git add lib/catalog.js
git commit -m "fix(catalog): read real menu-item schema blocks instead of nonexistent meta tags

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Correct `docs/content-schema.md`'s menu-item section

**Files:**
- Modify: `docs/content-schema.md`
- Verify: re-read against the real, live field data captured in this plan's Global Constraints

**Interfaces:** None — documentation only.

- [ ] **Step 1: Replace the "1. Menu item — an indexed content page" section** (from its heading down to, but not including, the "## 2. Ingredients" heading) with:

```markdown
## 1. Menu item — a DA schema-authored page

- **Location:** one page per sandwich under `/menu/<slug>` (e.g. `/menu/italian-stack`).
- **Authoring:** created in DA using the `menu-item` **schema** (DA's structured-content feature, distinct from the classic Metadata-block/meta-tag convention this project's other pages use). The schema form's fields render into a `<div class="menu-item">` body block — one row per field, each `<h3>label</h3>` paired with a value cell — not into page `<meta>` tags. `og:title`/`og:image`/etc. on these pages are generic placeholders and are never read by the app.
- **Discovery:** a scoped index (`helix-query.yaml`'s `menu` index, target `/menu/query-index.json`) lists every path under `/menu/**` for cheap enumeration. It declares no custom properties beyond `lastModified` — the real fields are never in the feed, only the path is used from it.
- **Extraction:** `lib/catalog.js`'s `getMenu()` discovers paths from the feed, then fetches and parses each page's `.plain.html` directly, finds its `menu-item` block, and reads each row as a `label → value` pair.

### Fields (rows inside the `menu-item` block)
| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | display name |
| `description` | string | yes | short menu blurb |
| `image` | URL | yes | author-uploaded photo, an absolute `content.da.live` or media URL |
| `price` | number (USD) | yes | e.g. `11` or `11.5` |
| `category` | enum: `signature` \| `classic` \| `veg` \| `seasonal` | yes | grouping + filter |
| `tags` | comma-list | no | e.g. `spicy, pork` |
| `special` | boolean (`true`) | no | featured / sandwich of the week |

### App validation (`lib/catalog.js`)
- Require `name`, `price`, `image`; drop rows missing them — a page missing a required field, or with no `menu-item` block at all, is silently excluded (never a thrown error).
- Coerce `price` to cents; a non-numeric or negative price drops the row. Default `category` to `signature` if absent/unknown. Decode HTML entities in field text (schema-authored copy can contain `&amp;` etc., e.g. "Roasted Turkey & Swiss").
```

- [ ] **Step 2: Re-read the replaced section and confirm it matches this plan's Global Constraints table** (all 7 fields present, category enum matches, the entity-decoding note present).

- [ ] **Step 3: Commit.**

```bash
git add docs/content-schema.md
git commit -m "docs(catalog): correct the menu-item schema to match how it's really authored

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Acceptance

- `getMenu()`'s field-extraction logic is proven correct against realistic fixtures (including the entity-decoding fix and the `test`-slug filter) and against all 6 real, live pages directly.
- `getIngredients()`'s public behavior is unchanged (same shape, same real ingredients content still parses — no regression).
- `helix-query.yaml`'s `menu` index no longer declares properties that can never populate.
- `docs/content-schema.md` accurately describes how menu items are really authored.
- `npm run lint` is green throughout.
- **Disclosed, not fixed by this plan:** end-to-end `getMenu()` against the live origin still returns `[]` until this branch (with Task 1's index change) merges to `main` and AEM Code Sync/the indexer picks it up — possibly requiring an explicit reindex afterward. This is an infrastructure/deploy-timing gap, not a code defect.
