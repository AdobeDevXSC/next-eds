# Hero Standardization + Menu Query-Index Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Confirm the hero block already matches Adobe's canonical content model, eliminate the per-item HTML fetch/parse in the menu catalog by sourcing full item data from an extended `/menu/query-index.json`, and split signin's persona markup into its own component.

**Architecture:** No changes to the EDS-blocks-as-React pipeline (`lib/registry.js`, `lib/eds/render.js`) or to `Hero.jsx`. The only architectural change is in the data layer: `helix-query.yaml`'s `menu` index gains custom `select`/`value` properties (using `hast-util-select`'s `:has()` + adjacent-sibling combinator, anchored to each schema field's real `id`), so `lib/catalog.js`'s `getMenu()` becomes a single query-index fetch instead of one fetch+parse per item.

**Tech Stack:** Next.js App Router (React Server Components), `helix-query.yaml` (AEM Edge Delivery indexing config), `hast-util-select`-based CSS selectors, plain CSS (no framework).

## Global Constraints

- No changes to `lib/eds/render.js`, `lib/registry.js`, `blocks/hero/Hero.jsx`, or any other block's React-port pattern.
- No changes to `getIngredients()` in `lib/catalog.js` — it's a single page, not a per-item catalog.
- No changes to `/signin`'s data source (`getPersonas()` via D1) or its auth flow (`/api/auth/persona`) — the signin change is a pure component-file split.
- `npm run lint` (ESLint + Stylelint) must pass before every commit — this repo has no unit test runner (`package.json` has no `test` script, no `*.test.js` files anywhere); verification is lint + `curl` against real endpoints + manual browser checks, matching this project's existing convention (see AGENTS.md's "Testing & Quality Assurance" and every prior fix this session).
- 2-space indentation, Unix line endings, block-scoped CSS selectors (per AGENTS.md).
- This work lands in a PR bundled together with the already-pushed spec doc and the mobile-nav/PWA fixes (commits `bea3641`, `39bafd9` on `fix/menu-images-and-nav-brand`) — do not open a separate PR.

---

### Task 1: Verify the hero already matches the canonical content model

**Files:** none modified — this task is verification-only, and is expected to produce no diff.

**Context:** The design spec assumed the hero's authored content and CSS would need hardening (based on an earlier, unrelated DA-stripping bug and the nav Sign-in button's class-stripping bug). Investigation during planning found both concerns already resolved:
- `index.html`'s hero section (fetched via `da_get_source` for `adobedevxsc/next-eds/index.html`) is already exactly the canonical single-row/single-cell structure: `<div class="hero"><div><div><picture>...</picture><h1>Stacked</h1><p>Build your lunch, brick by brick.</p><p><a href="/menu">Shop the menu</a> <a href="/build">Build your own</a></p></div></div></div>`.
- `blocks/hero/hero.css`'s `.hero p:last-child a` rules already style the CTA links structurally, selecting by position (`a:first-child` / `a:last-child` inside `.hero p:last-child`) rather than depending on an authored `class` attribute. There is nothing for DA to strip.

This task exists to make that verification explicit and repeatable, not to invent busywork.

- [ ] **Step 1: Re-fetch the current hero source and confirm structure**

Use the DA MCP tool to fetch the live source:

```
da_get_source(org="adobedevxsc", repo="next-eds", path="index.html")
```

Expected: the `<div class="hero">` block contains exactly one row (`<div>`) containing exactly one cell (`<div>`), and that cell contains `<picture>`, `<h1>`, and two `<p>` tags (tagline, then the CTA links). If this has drifted (e.g. someone re-authored it in DA since this plan was written), stop and re-open the design conversation — don't silently "fix" it to match this plan without checking why it changed.

- [ ] **Step 2: Confirm CTA link styling doesn't depend on an authored class**

Read `blocks/hero/hero.css`. Confirm `.hero p:last-child a:first-child` and `.hero p:last-child a:last-child` exist and set `background-color`/`color`/`border` directly (no `.button`-class-dependent selector anywhere in the file). If someone has since added a class-dependent rule, that's a regression risk (DA strips authored `class` attributes from raw anchors — confirmed earlier this session with the nav Sign-in link) — flag it rather than leaving it.

- [ ] **Step 3: Visual confirmation**

With the dev server running (`npx -y @adobe/aem-cli up` or the existing `next-eds-dev` Browser-pane preview), navigate to `/` and screenshot. Expected: hero renders with the sandwich illustration, "Stacked" heading, tagline, and two visibly-styled CTA buttons ("Shop the menu" solid, "Build your own" outlined) — matching the last screenshot taken this session.

- [ ] **Step 4: No commit**

This task produces no file changes. Move to Task 2.

---

### Task 2: Extend `helix-query.yaml`'s menu index with id-anchored field properties

**Files:**
- Modify: `helix-query.yaml`

**Interfaces:**
- Produces: `/menu/query-index.json` rows that include `name`, `description`, `image`, `price`, `category`, `tags`, `special` string fields (in addition to the existing `path` and `lastModified`) — Task 3 consumes these exact field names.

- [ ] **Step 1: Add the properties**

Open `helix-query.yaml`. Find the `menu:` index (it currently has only `lastModified` under `properties`). Replace its `properties` block with:

```yaml
  menu:
    include:
      - '/menu/**'
    target: /menu/query-index.json
    properties:
      lastModified:
        select: none
        value: parseTimestamp(headers('last-modified'), 'ddd, DD MMM YYYY hh:mm:ss GMT')
      name:
        select: .menu-item > div > div:has(> h3#name) + div
        value: textContent(el)
      description:
        select: .menu-item > div > div:has(> h3#description) + div
        value: textContent(el)
      image:
        select: .menu-item > div > div:has(> h3#image) + div
        value: textContent(el)
      price:
        select: .menu-item > div > div:has(> h3#price) + div
        value: textContent(el)
      category:
        select: .menu-item > div > div:has(> h3#category) + div
        value: textContent(el)
      tags:
        select: .menu-item > div > div:has(> h3#tags) + div
        value: textContent(el)
      special:
        select: .menu-item > div > div:has(> h3#special) + div
        value: textContent(el)
```

Each selector is anchored to the field's real `id` attribute (confirmed present via `curl https://main--next-eds--AdobeDevXSC.aem.live/menu/italian-stack.plain.html` — every field renders as `<div><div><h3 id="name">name</h3></div><div>The Italian Stack</div></div>`), using `hast-util-select`'s `:has(> h3#id)` to select the label cell and `+ div` to reach its sibling value cell. This means reordering fields in DA's schema editor won't break extraction — position doesn't matter, only the `id`.

- [ ] **Step 2: Validate YAML syntax**

```bash
node -e "const yaml = require('js-yaml'); yaml.load(require('fs').readFileSync('helix-query.yaml', 'utf8')); console.log('valid');"
```

If `js-yaml` isn't installed, use `npx -y js-yaml-cli helix-query.yaml` or simply open the file and check indentation carefully (YAML has no forgiving auto-correct) — every `properties:` entry must align with `lastModified:` above it.

Expected: `valid` printed, no exceptions.

- [ ] **Step 3: Commit**

```bash
git add helix-query.yaml
git commit -m "feat(catalog): index full menu-item fields into query-index.json

Anchor each property to the schema block's real id attribute (h3#name,
h3#price, etc.) via hast-util-select's :has() + adjacent-sibling
combinator, so reordering fields in DA's schema editor can't break
extraction."
```

- [ ] **Step 4: Push and re-preview existing menu items**

This config change only affects pages indexed *after* it takes effect — the six existing `/menu/*` pages already in the index were computed under the old config and won't pick up the new fields until each is re-previewed. Push the commit (code sync deploys the config), then re-preview every existing menu item page, e.g. via the `aem-project-management:ops` skill (`preview /menu/italian-stack`, `preview /menu/garden-veg-stack`, etc. — repeat for all six current items from the earlier `query-index.json` listing) or the admin API directly (`POST https://admin.hlx.page/preview/adobedevxsc/next-eds/main/menu/<slug>`, bearer IMS token). If IMS auth isn't available in this session (it wasn't reliably, earlier this session), tell the user which paths need re-previewing and let them do it via the DA sidekick's Preview button instead — don't skip this step silently, since without it Task 4's verification will fail with empty fields.

- [ ] **Step 5: Verify via curl**

```bash
curl -s https://main--next-eds--AdobeDevXSC.aem.live/menu/query-index.json | head -c 2000
```

Expected: each row now has non-empty `name`, `price`, `image` (at minimum) alongside `path`/`lastModified`. If any row has empty strings for these, that item wasn't re-previewed yet (or its selector doesn't match — double check the `id` attributes on that specific page via `.plain.html`).

---

### Task 3: Refactor `lib/catalog.js` to read menu-item fields from `query-index.json`

**Files:**
- Modify: `lib/catalog.js`

**Interfaces:**
- Consumes: `/menu/query-index.json` rows produced by Task 2, each shaped `{ path, lastModified, name, description, image, price, category, tags, special }` (all string values, per how `fetchQueryIndex` in `lib/eds/queryIndex.js` stores raw JSON rows).
- Produces: `getMenu(): Promise<MenuItem[]>` — same return shape as before (`{ slug, path, name, description, image, priceCents, category, tags, special }`), so `MenuCard.jsx` and `app/(site)/menu/page.js` need zero changes.

- [ ] **Step 1: Remove the per-item fetch/parse code**

In `lib/catalog.js`, delete:
- The `MENU_ITEM_BLOCK` constant (`const MENU_ITEM_BLOCK = 'menu-item';`).
- The `readFieldBlock(block)` function.
- The `fetchMenuItem(slug)` function in its entirety.

Keep everything else as-is: `toCents`, `decodeEntities`, `cellText` (still used by `getIngredients()`), `DA_ASSET_URL`, `toPublicAssetUrl`, `CATEGORIES`, `INGREDIENT_TYPES`, `IGNORED_MENU_SLUGS`, `getIngredients()`, and all three imports at the top (`fetchQueryIndex`, `fetchPlainHtml`/`EDS_ORIGIN`, `parseEds` — `fetchPlainHtml` and `parseEds` are still needed by `getIngredients()`).

- [ ] **Step 2: Rewrite `getMenu()`**

Replace the current `getMenu()` (which currently calls `fetchQueryIndex` for paths only, then maps every slug through `fetchMenuItem`) with:

```js
/**
 * Fetch every authored menu item directly from the scoped /menu/query-index.json feed, which
 * now carries full item data (see helix-query.yaml's menu index) — no per-item fetch needed.
 * @returns {Promise<MenuItem[]>}
 */
export async function getMenu() {
  const feed = await fetchQueryIndex('menu/query-index.json', { tags: CATALOG_TAGS });

  return [...feed.entries()]
    .map(([path, row]) => {
      const slug = path.replace(/^\/menu\//, '');
      if (!slug || IGNORED_MENU_SLUGS.has(slug)) return null;

      const name = decodeEntities(row.name || '').trim();
      const description = decodeEntities(row.description || '').trim();
      const image = (row.image || '').trim();
      const priceCents = toCents(row.price);
      // name, image, and a valid price are the only hard requirements (see
      // content-schema.md "App validation") — everything else has a safe default.
      if (!name || !image || priceCents === null) return null;

      const category = CATEGORIES.includes(row.category) ? row.category : 'signature';
      const tags = (row.tags || '').split(',').map((t) => t.trim()).filter(Boolean);

      return {
        slug,
        path,
        name,
        description,
        image: toPublicAssetUrl(image),
        priceCents,
        category,
        tags,
        special: row.special === 'true',
      };
    })
    .filter(Boolean);
}
```

This preserves the exact same validation semantics as the old `fetchMenuItem` (same required fields, same category fallback, same tags-splitting, same `special === 'true'` string check) — only the data source changed, from a per-item HTML parse to a query-index row.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: clean (no ESLint errors — in particular, no unused-import warnings for `fetchPlainHtml`/`parseEds`, which should still show as used by `getIngredients()`).

- [ ] **Step 4: Manual verification against the real feed**

With Task 2's re-previewed `query-index.json` live, start the dev server and check `/menu` renders identically to before the refactor:

```bash
npx -y @adobe/aem-cli up --no-open --forward-browser-logs
```

Navigate to `http://localhost:3000/menu` (or use the Browser pane). Expected: same items, same names/prices/descriptions/images/badges as the pre-refactor screenshot taken earlier this session — this is a data-source swap, not a visual change. If a real menu item is missing, check whether it's silently failing the `!name || !image || priceCents === null` guard — the most likely cause is Task 2's re-preview step being incomplete for that one page.

- [ ] **Step 5: Commit**

```bash
git add lib/catalog.js
git commit -m "refactor(catalog): read menu items from query-index.json, not per-item HTML

fetchMenuItem()/readFieldBlock() are gone — query-index.json now carries
every field directly (see the helix-query.yaml change), eliminating the
N+1 per-item fetch+parse. Same validation semantics, same MenuItem
shape, so MenuCard.jsx and menu/page.js are unchanged."
```

---

### Task 4: Extract `PersonaCard.jsx` from `signin/page.js`

**Files:**
- Create: `app/(site)/signin/PersonaCard.jsx`
- Modify: `app/(site)/signin/page.js`

**Interfaces:**
- Consumes: a `persona` object shaped `{ id, name, avatar_initials, loyalty_stamps }` (the shape `getPersonas()` in `lib/db.js` already returns — unchanged).
- Produces: `PersonaCard({ persona })` — a default-exported Server Component, matching `MenuCard({ item })`'s pattern in `app/(site)/menu/MenuCard.jsx`.

- [ ] **Step 1: Create `PersonaCard.jsx`**

```jsx
// Presentational card for one demo persona. Server Component — no client JS. Posts straight
// to /api/auth/persona; matches MenuCard.jsx's item-card pattern.
export default function PersonaCard({ persona }) {
  return (
    <form action="/api/auth/persona" method="POST" className="signin-persona">
      <input type="hidden" name="personaId" value={persona.id} />
      <span className="signin-avatar" aria-hidden="true">{persona.avatar_initials}</span>
      <span className="signin-persona-info">
        <span className="signin-persona-name">{persona.name}</span>
        <span className="signin-persona-meta">
          {persona.loyalty_stamps} loyalty stamp{persona.loyalty_stamps === 1 ? '' : 's'}
        </span>
      </span>
      <button type="submit" className="button primary signin-persona-btn">
        Sign in as {persona.name.split(' ')[0]}
      </button>
    </form>
  );
}
```

This is the exact JSX currently inline in `signin/page.js`'s `.map()`, moved verbatim except for taking `persona` as a prop instead of being a closure variable, and removing the `key` prop (that now lives on the `<PersonaCard>` call site in `page.js`, not inside the component).

- [ ] **Step 2: Update `page.js` to use it**

```jsx
import { getPersonas } from '../../../lib/db.js';
import PersonaCard from './PersonaCard.jsx';
import './signin.css';

export const metadata = { title: 'Sign in — Stacked' };
export const dynamic = 'force-dynamic';

export default async function SignInPage() {
  const personas = await getPersonas();

  return (
    <main className="signin-page">
      <div className="signin-card">
        <h1>Sign in</h1>
        <p className="signin-lede">Pick a demo account to explore Stacked as a returning customer.</p>
        <div className="signin-personas">
          {personas.map((persona) => <PersonaCard key={persona.id} persona={persona} />)}
        </div>
      </div>
    </main>
  );
}
```

No change to `getPersonas()`, `/api/auth/persona`, or `signin.css` — same markup, same classes, just relocated.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: clean.

- [ ] **Step 4: Manual verification**

Navigate to `http://localhost:3000/signin`. Expected: identical to the pre-refactor screenshot — persona cards with avatar initials, name, loyalty stamp count, and a working "Sign in as ___" button per persona. Click through a full sign-in (pick a persona, confirm you land signed in) to confirm `/api/auth/persona` still receives `personaId` correctly from the extracted form.

- [ ] **Step 5: Commit**

```bash
git add app/\(site\)/signin/PersonaCard.jsx app/\(site\)/signin/page.js
git commit -m "refactor(signin): extract PersonaCard.jsx, matching MenuCard.jsx's pattern

Pure relocation — same markup, same classes, same data source. No
behavior change."
```

---

### Task 5: Final verification and PR

**Files:** none — this task bundles verification of everything above plus the two commits already on the branch (`bea3641` spec doc, `39bafd9` mobile-nav/PWA fixes) into one PR.

- [ ] **Step 1: Full lint pass**

```bash
npm run lint
```

Expected: clean.

- [ ] **Step 2: Full manual walkthrough**

With the dev server running, check in order: `/` (hero unaffected), `/menu` (items render from the new data source, prices/images/badges correct), `/build` (unaffected — sanity check nothing else broke), `/signin` (persona cards render and sign-in works end to end).

- [ ] **Step 3: Open the PR**

```bash
git push
gh pr create --title "Hero verification, menu query-index refactor, signin component split" --body "$(cat <<'EOF'
## Summary
- Verified the hero block already matches Adobe's canonical Block Collection content model (no code/content changes needed) — see docs/superpowers/specs/2026-08-17-hero-block-menu-react-design.md
- Extended helix-query.yaml's menu index with id-anchored properties so /menu/query-index.json carries full item data; refactored lib/catalog.js to drop the per-item HTML fetch/parse
- Extracted signin/PersonaCard.jsx, matching MenuCard.jsx's pattern
- Also includes: the design spec doc, and the earlier mobile-nav-offset + PWA iOS meta fixes (bea3641, 39bafd9)

## Test plan
- [x] npm run lint clean
- [x] /menu renders identical items after the data-source swap
- [x] /signin persona cards render and sign-in works end to end
- [ ] CI green
EOF
)"
```

- [ ] **Step 4: Verify CI**

```bash
gh pr checks --watch
```

Expected: all green. If red, read the failure log before assuming — this session has hit real config-driven failures before (the wrangler.jsonc binding mismatch) that looked like code bugs but weren't.
