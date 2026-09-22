// Menu List — portable OOTB presentation block (Tier 1). The EDS-only twin of the Next /menu
// route (app/(site)/menu/page.js + MenuCard.jsx): client-fetches the authored catalog index
// (/menu/query-index.json) and renders the same card grid, so the raw EDS surface has a working
// menu page without the Next/RSC app. See docs/architecture/blocks-and-rsc.md.
//
// Authored content: an empty block. Optionally, a single cell may override the index path
// (default /menu/query-index.json). Data comes from the query-index, not from authored rows.
const DEFAULT_INDEX = '/menu/query-index.json';

// Parse a decimal USD price string ("11", "9.5") to a "$9.50" display string, or null if invalid.
// Mirrors MenuCard.jsx's priceCents/100.toFixed(2), from the query-index's raw string field.
function formatPrice(raw) {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? `$${n.toFixed(2)}` : null;
}

// The query-index stores the private, auth-gated DA asset URL
// (https://content.da.live/<org>/<repo>/menu/assets/x.svg → 401). The same asset is public at the
// EDS origin under the same path, so rewrite to a root-relative URL. Mirrors
// lib/catalog.js's toPublicAssetUrl (which targets EDS_ORIGIN; here the block runs on that origin).
const DA_ASSET_URL = /^https?:\/\/content\.da\.live\/[^/]+\/[^/]+\/(.+)$/i;
function toPublicAssetUrl(url) {
  const match = url.match(DA_ASSET_URL);
  return match ? `/${match[1]}` : url;
}

function buildCard(item) {
  const path = item.path || (item.slug ? `/menu/${item.slug}` : '');
  const image = (item.image || '').trim();
  const price = formatPrice(item.price);
  // name, image, and a valid price are the hard requirements — mirror lib/catalog.js so the
  // EDS-only menu drops incomplete rows rather than rendering broken cards.
  if (!path || !item.name || !image || !price) return null;

  const card = document.createElement('a');
  card.className = 'menu-card';
  card.href = path;

  const media = document.createElement('div');
  media.className = 'menu-card-media';
  const img = document.createElement('img');
  img.src = toPublicAssetUrl(image);
  img.alt = item.name;
  img.loading = 'lazy';
  media.append(img);
  if (String(item.special).trim() === 'true') {
    const badge = document.createElement('span');
    badge.className = 'menu-card-badge';
    badge.textContent = 'Special';
    media.append(badge);
  }

  const body = document.createElement('div');
  body.className = 'menu-card-body';

  const row = document.createElement('div');
  row.className = 'menu-card-row';
  const name = document.createElement('h3');
  name.className = 'menu-card-name';
  name.textContent = item.name;
  const priceEl = document.createElement('span');
  priceEl.className = 'menu-card-price';
  priceEl.textContent = price;
  row.append(name, priceEl);
  body.append(row);

  if (item.description) {
    const desc = document.createElement('p');
    desc.className = 'menu-card-description';
    desc.textContent = item.description;
    body.append(desc);
  }

  card.append(media, body);
  return card;
}

function renderEmpty(block, message) {
  const p = document.createElement('p');
  p.className = 'menu-empty';
  p.textContent = message;
  block.textContent = '';
  block.append(p);
}

/**
 * loads and decorates the menu-list block
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const override = block.querySelector(':scope > div > div')?.textContent.trim();
  const indexUrl = override || DEFAULT_INDEX;
  block.textContent = '';

  let items = [];
  try {
    const res = await fetch(indexUrl);
    if (!res.ok) throw new Error(`query-index ${res.status}`);
    const json = await res.json();
    items = Array.isArray(json.data) ? json.data : [];
  } catch {
    renderEmpty(block, 'The menu is unavailable right now — please try again later.');
    return;
  }

  const cards = items.map(buildCard).filter(Boolean);
  if (cards.length === 0) {
    renderEmpty(block, 'No sandwiches on the menu yet — check back soon.');
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'menu-grid';
  cards.forEach((c) => grid.append(c));
  block.append(grid);
}
