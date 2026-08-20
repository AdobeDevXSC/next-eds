# Stacked — catalog content schema (EDS structured content)

How the catalog is authored as **EDS structured content** — not spreadsheets — and how the app consumes it. There are two content types: **menu items** (indexed content pages) and **ingredients** (a structured block). Companion to the [demo spec](superpowers/specs/2026-08-13-stacked-demo-design.md).

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

## 2. Ingredients — a structured block

- **Location:** a single authored page `/config/ingredients` holding one `Ingredients` block. Not indexed; the app fetches `/config/ingredients.plain.html` and parses the block.
- **Block schema:** first row is the block name `Ingredients`; each following row is one ingredient.

### Columns
| Column | Type | Required | Notes |
|---|---|---|---|
| `type` | enum: `bread` \| `protein` \| `cheese` \| `veg` \| `sauce` \| `extra` | yes | groups the palette; drives select mode |
| `name` | string | yes | display label; also the source for the app-derived `id` (see below) |
| `price` | number (USD) | yes | see pricing rule |
| `default` | boolean (`true`) | no | pre-selected in the builder |
| `color` | hex color, e.g. `#E0B678` | no | swatch color in the builder UI — presentational only; a row missing it is still parsed and rendered, just with an empty swatch, unlike the required columns above |

### Rules
- **Pricing:** `bread` prices are the **base price** of the build (choosing a bread sets the base); every other type is an **additive upcharge** (`0` = included). No separate base-price field.
- **Selection:** `bread` is single-select (one base); every other `type` is multi-select. The mapping lives in the app, keyed by `type`.
- **Id:** not an authored column — the app derives a stable `id` from `name` (lowercase, `&` → space, any run of remaining non-alphanumeric characters collapsed to a single `-`, leading/trailing `-` trimmed), e.g. "Salami & Capicola" → `salami-capicola`. Used as the builder's selection/React key.

### Example authored block
```
| Ingredients |            |       |         |         |
| ----------- | ---------- | ----- | ------- | ------- |
| bread       | Ciabatta   | 8.50  | true    | #E7C288 |
| bread       | Sourdough  | 8.50  |         | #E0B678 |
| protein     | Turkey     | 0     | true    | #D9A273 |
| protein     | Bacon      | 2     |         | #8E4B33 |
| cheese      | Provolone  | 1     |         | #F2C14E |
| veg         | Lettuce    | 0     | true    | #6E8F4A |
| sauce       | Pesto mayo | 0     | true    | #8A6A3E |
| extra       | Avocado    | 1.50  |         | #7E9B4E |
```

### Parsed shape (app)
```json
{
  "bread":   [{ "id": "ciabatta", "name": "Ciabatta", "priceCents": 850, "default": true, "color": "#E7C288" }, ...],
  "protein": [{ "id": "turkey", "name": "Turkey", "priceCents": 0, "default": true, "color": "#D9A273" }, ...],
  "cheese":  [...], "veg": [...], "sauce": [...], "extra": [...]
}
```

`getBuilderPalette()` (also in `lib/catalog.js`) composes this into the `/build` page's palette:
it groups the above by `type` under a fixed, code-defined display config (label/note/select-mode
and category order — `bread, protein, cheese, veg, sauce`; UI structure, not authored content),
dropping any category with zero authored items. `extra` has no entry in that display config, so
`extra` rows are parsed but never rendered on `/build`.

## 3. Consumption & caching (`lib/catalog.js`)
- `getMenu()` → discover paths via `/menu/query-index.json` (path/lastModified only), then fetch and parse each page's `menu-item` block directly, coerce/validate → `MenuItem[]`.
- `getIngredients()` → fetch `/config/ingredients.plain.html`, parse the `Ingredients` block → grouped palette. `getBuilderPalette()` composes that into the `/build` page's ordered category array (see §2).
- Both cached with ISR + a `catalog` revalidation tag. `/api/revalidate` busts `catalog` when any `/menu/**` page or `/config/ingredients` publishes.
- Orders capture a **price/build snapshot** at order time, so later catalog edits never rewrite history.

## 4. helix-query.yaml
The scoped `menu` index (target `/menu/query-index.json`) exists purely for path discovery — it declares no custom properties beyond `lastModified`, since menu-item fields live in a body block, not `<meta>` tags (see §1). `/config/**` is excluded from the default index so the ingredients page isn't a browsable result.

## 5. Authoring workflow
- **Add / edit a sandwich:** create or edit `/menu/<slug>` in DA using the `menu-item` schema, fill in its fields (name, description, price, category, tags, special), add a photo, preview, publish → the page appears under `/menu/query-index.json`'s paths → `getMenu()` picks it up.
- **Edit ingredients / prices:** edit the `Ingredients` block rows on `/config/ingredients`, publish → the builder updates.
- All menu and ingredient content is **synthetic demonstration data**; label it as such wherever a visitor could mistake it for real.

## 6. Why structured content, not sheets
- Menu items are real content pages — own URL, image, description, detail view — a natural fit for EDS and the query-index this project already uses.
- The ingredients block gives authors a compact, schema'd table without a separate spreadsheet tool.
- One authoring surface (Docs/DA), one publish flow, indexed + parsed at the edge — and it showcases EDS structured content, which is the point of the demo.
