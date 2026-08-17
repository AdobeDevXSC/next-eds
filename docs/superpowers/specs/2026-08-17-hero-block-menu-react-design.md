# Hero standardization + menu-item query-index refactor

## Context

Two unrelated pieces of technical debt, addressed together because they were both raised in the same request:

1. **Hero content model.** `blocks/hero/Hero.jsx` is a React Server Component (part of this repo's
   custom EDS-blocks-as-React pipeline — see `lib/registry.js` / `lib/eds/render.js`, which
   already replaced the classic vanilla-JS `decorate()` convention from AGENTS.md for every
   block: `Cards`, `Columns`, `Steps`, `Tabs`, `Callout`, `Header`, `Footer`, `Hero`). Hero
   currently reads `rows?.[0]?.[0]?.html` — one freeform HTML blob. Earlier this session, hero
   content authored directly as `<div class="hero">` children (no row/cell wrapper) was silently
   stripped by DA's storage; the fix was wrapping it in a row/cell. Confirmed against Adobe's own
   Block Collection reference (`github.com/adobe/aem-block-collection`, `blocks/hero`): the
   canonical hero block *is* exactly this — one row, one cell, picture + heading + paragraphs
   together, no decoration JS at all, just CSS layering the picture behind the text. So Hero.jsx
   already matches the canonical content model; the gap is authoring reliability, not code.

2. **Menu-item data sourcing.** Menu items are authored via DA's schema feature
   (`x-schema-name: menu-item`), which renders fields into a body block with real `id` anchors per
   field (`h3#name`, `h3#price`, etc.) — confirmed via `curl .../menu/italian-stack.plain.html`.
   `lib/catalog.js`'s `getMenu()` currently does: fetch `/menu/query-index.json` for paths only,
   then for every item, fetch that item's `.plain.html` and parse the schema block with
   `parseEds`/`readFieldBlock` (an N+1 fetch pattern). AEM does **not** serve a native `.json`
   representation of a schema-authored page (confirmed: `/menu/italian-stack.json` → 404). The fix
   is extending `helix-query.yaml`'s `menu` index with custom `select`/`value` properties, so
   `/menu/query-index.json` itself carries every field — eliminating the per-item fetch entirely.

Also in scope: extracting signin's persona markup into its own component, matching the
`MenuCard.jsx` pattern.

## Non-goals

- No change to `lib/eds/render.js`, `lib/registry.js`, or any other block's React-port pattern.
- No change to `getIngredients()` — it's a single page, not a per-item catalog; there's no N+1 to
  eliminate there.
- No change to `/signin`'s data source (D1 via `getPersonas()`) or its auth flow
  (`/api/auth/persona`) — this is a pure component-file split, not a behavior change.
- Not attempting to make the query-index approach scale to a large catalog — see Trade-offs.

## Design

### 1. Hero: content-model hardening (no code change to Hero.jsx)

Re-author `index.html`'s hero section in DA as a single row/cell block matching the canonical
Block Collection structure exactly:

```html
<div class="hero">
  <div>
    <div>
      <picture>...</picture>
      <h1>Stacked</h1>
      <p>Build your lunch, brick by brick.</p>
      <p><a href="/menu">See the menu</a> <a href="/build">Build your own</a></p>
    </div>
  </div>
</div>
```

Add a structural CTA-link style to `blocks/hero/hero.css` (DA strips authored `class` attributes
from raw anchors — confirmed earlier with the nav Sign-in link — so the button look must not
depend on an authored class surviving DA):

```css
.hero a {
  /* punch button styling, same structural approach as header.css's .nav-tools a */
}
```

`Hero.jsx`, `lib/eds/render.js`, and `lib/registry.js` are unchanged. Verify via `da_get_source`
after the edit that DA didn't silently drop anything (same check used for the earlier hero bug).

### 2. Menu: query-index carries full item data

**`helix-query.yaml`** — extend the `menu` index's `properties` with one entry per field, each
anchored to the field's real `id` via `hast-util-select`'s `:has()` + adjacent-sibling combinator
(confirmed supported by `hast-util-select`, which the indexer uses to run selectors against raw
HTML markup, not the rendered DOM):

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

Anchoring to the field's `id` (rather than row position) means reordering fields in DA's schema
editor won't break extraction.

**`lib/catalog.js`** — `getMenu()` reads every field directly off each `query-index.json` row.
Deleted: `fetchMenuItem()`, `readFieldBlock()`, and `cellText()`'s block-parsing call site (the
`MENU_ITEM_BLOCK` constant and the `parseEds`/`fetchPlainHtml` import for per-item fetches).
Unchanged: `toCents()`, `decodeEntities()`, `toPublicAssetUrl()`, the `CATEGORIES` validation, and
the `!fields.name || !fields.image || priceCents === null` drop rule — same validation, now fed
from a query-index row instead of a parsed block cell. `IGNORED_MENU_SLUGS` stays as a defensive
filter even though the validation rule alone would now catch the `test` scaffold row (it has no
real `menu-item` block, so its extracted fields are empty).

`getMenu()`'s return shape (`MenuItem[]`) is unchanged, so `MenuCard.jsx` and
`app/(site)/menu/page.js` need no changes.

### 3. Signin: extract PersonaCard.jsx

Move the per-persona `<form>` block out of `app/(site)/signin/page.js` into
`app/(site)/signin/PersonaCard.jsx`, taking a `persona` prop — same shape as `MenuCard.jsx` taking
an `item` prop. `page.js` becomes:

```jsx
{personas.map((persona) => <PersonaCard key={persona.id} persona={persona} />)}
```

No change to `getPersonas()`, `/api/auth/persona`, `signin.css`, or rendered markup.

## Trade-offs

Every property added to the `menu` index gets computed for every page under `/menu/**` on every
publish, and adds bytes to every row in `query-index.json` regardless of whether that page is a
real menu item. At demo scale (~6 items) this is a non-issue. It would not be the right move for a
catalog with hundreds of items or heavy per-item content — at that scale, a dedicated per-item
JSON endpoint (a Next.js API route parsing the schema block server-side) would scale better than
one wide index row per item.

## Testing / validation plan

1. Update `helix-query.yaml`, preview `/menu/*` pages, confirm via `curl` that
   `/menu/query-index.json` now carries `name`/`price`/`image`/etc.
2. Update `catalog.js`, run `npm run lint`.
3. `npx aem up` locally, verify `/menu` renders identical cards to today.
4. Re-author hero content in DA, preview `/index`, verify via `da_get_source` the content
   survived, then visually confirm the homepage hero renders unchanged.
5. Extract `PersonaCard.jsx`, verify `/signin` renders identically and persona sign-in still works
   end to end.
6. `npm run lint` clean, open a PR following the same pattern as recent changes this session.
