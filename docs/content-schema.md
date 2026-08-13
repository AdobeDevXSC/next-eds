# Stacked — catalog content schema (EDS structured content)

How the catalog is authored as **EDS structured content** — not spreadsheets — and how the app consumes it. There are two content types: **menu items** (indexed content pages) and **ingredients** (a structured block). Companion to the [demo spec](superpowers/specs/2026-08-13-stacked-demo-design.md).

## 1. Menu item — an indexed content page

- **Location:** one page per sandwich under `/menu/<slug>` (e.g. `/menu/italian-stack`).
- **Authoring:** a normal EDS document. The page body holds the rich description (and can render as a detail view at `/menu/<slug>`). Structured fields live in the page's **Metadata** table, which EDS emits as `<meta>` tags.
- **Indexing:** `helix-query.yaml` indexes `/menu/**` into a scoped feed `/menu/query-index.json`; the app reads the feed (one request, paged) rather than fetching each page.

### Fields
| Field | Source | Type | Required | Notes |
|---|---|---|---|---|
| `name` | `meta[property="og:title"]` | string | yes | display name |
| `description` | `meta[name="description"]` | string | yes | short menu blurb |
| `image` | `meta[property="og:image"]` | URL | yes | author-uploaded photo (auto-optimized) |
| `price` | `meta[name="price"]` | number (USD) | yes | e.g. `11` or `11.00` |
| `category` | `meta[name="category"]` | enum: `signature` \| `classic` \| `veg` \| `seasonal` | yes | grouping + filter |
| `tags` | `meta[name="tags"]` | comma-list | no | e.g. `spicy, pork` |
| `special` | `meta[name="special"]` | boolean (`true`) | no | featured / sandwich of the week |

### Feed row shape (`/menu/query-index.json` → `.data[]`)
```json
{
  "path": "/menu/italian-stack",
  "name": "The Italian Stack",
  "description": "Salami, capicola, provolone, hot peppers on ciabatta.",
  "image": "/menu/media_...jpg",
  "price": "11",
  "category": "signature",
  "tags": "spicy, pork",
  "special": "true",
  "lastModified": "..."
}
```
query-index values are strings; the app coerces `price` → integer cents and `special` → boolean.

### App validation (`lib/catalog.js`)
- Require `name`, `price`, `image`; drop and log rows missing them (degrade gracefully — never 500 the menu).
- Coerce `price` to cents; clamp negative/NaN to skip. Default `category` to `signature` if absent/unknown.

## 2. Ingredients — a structured block

- **Location:** a single authored page `/config/ingredients` holding one `Ingredients` block. Not indexed; the app fetches `/config/ingredients.plain.html` and parses the block.
- **Block schema:** first row is the block name `Ingredients`; each following row is one ingredient.

### Columns
| Column | Type | Required | Notes |
|---|---|---|---|
| `type` | enum: `bread` \| `protein` \| `cheese` \| `veg` \| `sauce` \| `extra` | yes | groups the palette; drives select mode |
| `name` | string | yes | display label |
| `price` | number (USD) | yes | see pricing rule |
| `default` | boolean (`true`) | no | pre-selected in the builder |

### Rules
- **Pricing:** `bread` prices are the **base price** of the build (choosing a bread sets the base); every other type is an **additive upcharge** (`0` = included). No separate base-price field.
- **Selection:** `bread` is single-select (one base); every other `type` is multi-select. The mapping lives in the app, keyed by `type`.

### Example authored block
```
| Ingredients |            |       |         |
| ----------- | ---------- | ----- | ------- |
| bread       | Ciabatta   | 8.50  | true    |
| bread       | Sourdough  | 8.50  |         |
| protein     | Turkey     | 0     | true    |
| protein     | Bacon      | 2     |         |
| cheese      | Provolone  | 1     |         |
| veg         | Lettuce    | 0     | true    |
| sauce       | Pesto mayo | 0     | true    |
| extra       | Avocado    | 1.50  |         |
```

### Parsed shape (app)
```json
{
  "bread":   [{ "name": "Ciabatta", "priceCents": 850, "default": true }, ...],
  "protein": [{ "name": "Turkey", "priceCents": 0, "default": true }, ...],
  "cheese":  [...], "veg": [...], "sauce": [...], "extra": [...]
}
```

## 3. Consumption & caching (`lib/catalog.js`)
- `getMenu()` → fetch `/menu/query-index.json` (generalize `lib/eds/queryIndex.js` to accept a feed path), coerce/validate → `MenuItem[]`.
- `getIngredients()` → fetch `/config/ingredients.plain.html`, parse the `Ingredients` block → grouped palette.
- Both cached with ISR + a `catalog` revalidation tag. `/api/revalidate` busts `catalog` when any `/menu/**` page or `/config/ingredients` publishes.
- Orders capture a **price/build snapshot** at order time, so later catalog edits never rewrite history.

## 4. helix-query.yaml
A scoped `menu` index (target `/menu/query-index.json`) carries the fields above; `/config/**` is excluded from the default index so the ingredients page isn't a browsable result. The custom properties (`price`, `category`, `tags`, `special`) read from the `<meta name="…">` tags EDS emits from each page's Metadata table.

## 5. Authoring workflow
- **Add / edit a sandwich:** create or edit `/menu/<slug>`, fill the Metadata table (`price`, `category`, `tags`, `special`), add the description + image, preview, publish → it appears in `/menu/query-index.json` → live.
- **Edit ingredients / prices:** edit the `Ingredients` block rows on `/config/ingredients`, publish → the builder updates.
- All menu and ingredient content is **synthetic demonstration data**; label it as such wherever a visitor could mistake it for real.

## 6. Why structured content, not sheets
- Menu items are real content pages — own URL, image, description, detail view — a natural fit for EDS and the query-index this project already uses.
- The ingredients block gives authors a compact, schema'd table without a separate spreadsheet tool.
- One authoring surface (Docs/DA), one publish flow, indexed + parsed at the edge — and it showcases EDS structured content, which is the point of the demo.
