import { fetchQueryIndex } from './eds/queryIndex.js';
import { fetchPlainHtml, EDS_ORIGIN } from './eds/fetch.js';
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
 * "Turkey &amp; Swiss"), plus numeric character references (hex and decimal, e.g. "&#x26;" /
 * "&amp;#38;") — DA's editor emits numeric refs for some characters, not just named entities.
 * A full HTML-entity table isn't worth a dependency for this. */
function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)));
}

/** Strip tags, decode entities, and collapse whitespace to get a table cell's plain text. */
function cellText(cell) {
  if (!cell) return '';
  return decodeEntities(cell.html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Matches an asset URL authors paste straight from DA's editor, e.g.
// https://content.da.live/adobedevxsc/next-eds/menu/assets/italian-stack.svg — DA's own admin
// API, which requires an authenticated session and 401s for an anonymous site visitor. Any
// asset uploaded to the content source is *also* servable straight from the EDS origin at the
// same path with no auth (confirmed: https://main--next-eds--AdobeDevXSC.aem.page/menu/assets/
// italian-stack.svg -> 200), so this rewrites to that public equivalent. Anything else
// (already-relative, or some other host entirely) passes through untouched.
const DA_ASSET_URL = /^https?:\/\/content\.da\.live\/[^/]+\/[^/]+\/(.+)$/i;

/** Rewrite a content.da.live asset URL (private, auth-gated) to its public EDS-origin
 * equivalent. Non-matching URLs (already relative, or a different host) pass through as-is.
 * @param {string} url
 * @returns {string}
 */
function toPublicAssetUrl(url) {
  const match = DA_ASSET_URL.exec(url);
  return match ? `${EDS_ORIGIN}/${match[1]}` : url;
}

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
