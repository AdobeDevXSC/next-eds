// Sandwich Builder — portable OOTB presentation block (Tier 1). The EDS-only twin of the Next
// /build route (app/(site)/build/Builder.jsx): a client-side sandwich builder that reads the same
// authored ingredient palette (/config/ingredients) and updates the stack, brick count, and
// running total on every tap. Focused flow — it hides the global header/footer/tab-bar and renders
// its own header + dock, matching the app's chromeless build. The one difference: raw EDS has no
// cart, so "Add to order" is a link to /menu instead of a cart action. See
// docs/architecture/blocks-and-rsc.md.
//
// Authored content: an empty block. The palette is fetched, not authored here.
const PALETTE_URL = '/config/ingredients.plain.html';

// Category display metadata — mirrors lib/catalog.js's BUILDER_CATEGORIES (label/note/order).
const CATEGORIES = [
  { key: 'bread', label: 'Bread', note: 'pick one' },
  { key: 'protein', label: 'Protein', note: 'stack as many as you like' },
  { key: 'cheese', label: 'Cheese', note: 'stack as many as you like' },
  { key: 'veg', label: 'Veg & pickles', note: 'free-ish' },
  { key: 'sauce', label: 'Sauce', note: 'one or two' },
];
// Stack render order top→bottom: top bread, then fillings in this order, then base bread.
const FILLING_ORDER = ['protein', 'cheese', 'veg', 'sauce'];
const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

const formatPrice = (cents) => `$${(cents / 100).toFixed(2)}`;
const bricksWord = (n) => `${NUM_WORDS[n] || String(n)} brick${n === 1 ? '' : 's'}`;

// Match lib/catalog.js: deriveIngredientId + toCents.
const deriveId = (name) => name.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function toCents(raw) {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

// Stable pseudo-random width/rotation keyed to an id, so bricks don't jitter between renders.
function hashId(id) {
  let h = 0;
  // eslint-disable-next-line no-bitwise
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const brickWidth = (id) => 204 + (hashId(id) % 17);
const brickRotation = (id) => ((hashId(id) % 19) - 9) / 10;

// Fetch + parse /config/ingredients into { bread:[], protein:[], ... }. Mirrors getIngredients().
async function fetchPalette() {
  const groups = {
    bread: [], protein: [], cheese: [], veg: [], sauce: [],
  };
  const res = await fetch(PALETTE_URL);
  if (!res.ok) throw new Error(`ingredients ${res.status}`);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  const block = doc.querySelector('.ingredients');
  if (!block) return groups;
  [...block.children].forEach((row) => {
    const cells = row.children;
    const type = (cells[0]?.textContent || '').trim().toLowerCase();
    const name = (cells[1]?.textContent || '').trim();
    const priceCents = toCents((cells[2]?.textContent || '').trim());
    if (!groups[type] || !name || priceCents === null) return;
    const id = deriveId(name);
    if (!id) return;
    groups[type].push({
      id,
      name,
      priceCents,
      default: (cells[3]?.textContent || '').trim().toLowerCase() === 'true',
      color: (cells[4]?.textContent || '').trim(),
    });
  });
  return groups;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export default async function decorate(block) {
  let groups;
  try {
    groups = await fetchPalette();
  } catch {
    block.textContent = '';
    block.append(el('p', 'builder-empty', 'The builder is unavailable right now — please try again later.'));
    return;
  }

  const palette = CATEGORIES
    .map((c) => ({ ...c, items: groups[c.key] || [] }))
    .filter((c) => c.items.length > 0);
  const breads = groups.bread || [];
  const defaultBread = breads.find((b) => b.default) || breads[0] || null;

  // State
  let breadId = defaultBread?.id || '';
  const selected = new Set();
  palette.forEach((cat) => {
    if (cat.key === 'bread') return;
    cat.items.forEach((it) => { if (it.default) selected.add(it.id); });
  });

  // Focused flow: hide the global chrome for this page.
  document.body.classList.add('sandwich-builder-page');

  // ---- Build DOM ----
  const root = el('div', 'builder');

  // Header
  const header = el('header', 'builder-header');
  const hInner = el('div', 'builder-header-inner');
  const back = el('a', 'builder-back', '←');
  back.href = '/';
  back.setAttribute('aria-label', 'Back to home');
  const title = el('span', 'builder-title', 'Build your own');
  const clearBtn = el('button', 'builder-clear', 'Clear');
  clearBtn.type = 'button';
  hInner.append(back, title, clearBtn);
  header.append(hInner, el('div', 'accent-strip'));

  // Preview
  const preview = el('section', 'builder-preview');
  const stack = el('div', 'stack-preview');
  stack.setAttribute('aria-hidden', 'true');
  const meta = el('div', 'preview-meta');
  const count = el('span', 'preview-count');
  const total = el('span', 'preview-total');
  meta.append(count, total);
  preview.append(stack, meta);

  // Groups
  const groupsWrap = el('div', 'builder-groups');
  const pillsById = new Map();
  palette.forEach((cat) => {
    const section = el('section', 'ing-group');
    const head = el('h2', 'ing-group-head');
    head.append(el('span', 'ing-group-label', cat.label), el('span', 'ing-group-note', cat.note));
    const pills = el('div', 'ing-pills');
    cat.items.forEach((it) => {
      const pill = el('button', 'pill');
      pill.type = 'button';
      const swatch = el('span', 'pill-swatch');
      swatch.style.setProperty('--brick-color', it.color);
      const name = el('span', 'pill-name', it.name);
      const check = el('span', 'pill-check', '✓');
      check.setAttribute('aria-hidden', 'true');
      const delta = cat.key === 'bread' ? it.priceCents - (defaultBread?.priceCents || 0) : it.priceCents;
      const price = el('span', 'pill-price', `+${formatPrice(delta)}`);
      pill.append(swatch, name, check, price);
      pill.addEventListener('click', () => {
        if (cat.key === 'bread') breadId = it.id;
        else if (selected.has(it.id)) selected.delete(it.id);
        else selected.add(it.id);
        // eslint-disable-next-line no-use-before-define
        render();
      });
      pillsById.set(it.id, {
        pill, check, price, delta, isBread: cat.key === 'bread',
      });
      pills.append(pill);
    });
    section.append(head, pills);
    groupsWrap.append(section);
  });

  // Dock
  const dock = el('div', 'builder-dock');
  const dockTotal = el('div', 'dock-total');
  const dockVal = el('span', 'dock-total-val');
  dockTotal.append(el('span', 'dock-total-cap', 'running total'), dockVal);
  const addLink = el('a', 'dock-add', 'Add to order');
  addLink.href = '/menu';
  dock.append(dockTotal, addLink);

  root.append(header, preview, groupsWrap, dock);
  block.textContent = '';
  block.append(root);

  // ---- Render (called on every change) ----
  function render() {
    const bread = breads.find((b) => b.id === breadId) || defaultBread;

    // Stack bricks
    const rows = [];
    if (bread) rows.push({ key: 'bread-top', color: bread.color, bread: true });
    FILLING_ORDER.forEach((catKey) => {
      (groups[catKey] || []).forEach((it) => {
        if (selected.has(it.id)) rows.push({ key: it.id, color: it.color });
      });
    });
    if (bread) {
      rows.push({
        key: 'bread-base', color: bread.color, bread: true, base: true,
      });
    }

    stack.textContent = '';
    rows.forEach((b) => {
      const brick = el('span', `stack-brick${b.base ? ' stack-brick-base' : ''}`);
      brick.style.setProperty('--brick-color', b.color);
      brick.style.setProperty('--brick-w', b.bread ? '220px' : `${brickWidth(b.key)}px`);
      brick.style.setProperty('--brick-rot', b.bread ? '0deg' : `${brickRotation(b.key)}deg`);
      stack.append(brick);
    });

    // Totals
    const totalCents = (bread?.priceCents || 0) + palette.reduce((sum, cat) => (cat.key === 'bread'
      ? sum
      : sum + cat.items.reduce((s, it) => (selected.has(it.id) ? s + it.priceCents : s), 0)), 0);
    const brickCount = selected.size + (bread ? 2 : 0);
    count.textContent = `${bricksWord(brickCount)} · ${bread?.name?.toLowerCase() || 'no'} base`;
    total.textContent = formatPrice(totalCents);
    dockVal.textContent = formatPrice(totalCents);

    // Pill states
    pillsById.forEach(({
      pill, check, price, delta, isBread,
    }, id) => {
      const isOn = isBread ? bread?.id === id : selected.has(id);
      pill.classList.toggle('pill-on', isOn);
      pill.setAttribute('aria-pressed', String(isOn));
      check.style.display = isOn ? '' : 'none';
      price.style.display = !isOn && delta > 0 ? '' : 'none';
    });
  }

  clearBtn.addEventListener('click', () => {
    breadId = defaultBread?.id || '';
    selected.clear();
    render();
  });

  render();
}
