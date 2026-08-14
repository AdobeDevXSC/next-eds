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
