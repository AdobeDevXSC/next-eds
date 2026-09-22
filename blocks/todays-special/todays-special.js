// Today's Special — portable OOTB presentation block (Tier 1). A static twin of the Next-only
// todays-pick island (components/blocks/TodaysPick.jsx): same card visual, but the cart
// "Add to order" button is a plain link, so it renders identically on both raw EDS and Next
// (via LegacyBlock) with no app state. Used by the EDS-only /index-eds page. See
// docs/architecture/blocks-and-rsc.md and the 2026-09-22-eds-only-homepage-design.md spec.
//
// Authored content: ONE row, 5 cells —
//   [badge, name, price, description, cta]
// The cta cell is a link (real <a>, or a plain-text path fallback like "/menu"). The decorative
// brick-stack colors are NOT authored; they're baked below (a fixed brand illustration from the
// original design handoff), the same pattern blocks/hero-stack and blocks/two-ways use.
const STACK_COLORS = ['#E7C288', '#D9A273', '#F2C14E', '#B98A3C', '#E7C288'];

// A CTA href cell may be authored as a real link, or as a plain-text path (e.g. "/menu") — same
// defensive pattern as blocks/two-ways/two-ways.js's readHref.
function readHref(cell) {
  const link = cell?.querySelector('a');
  if (link) return link.getAttribute('href') || '#';
  return cell?.textContent.trim() || '#';
}

/**
 * loads and decorates the todays-special block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cells = block.querySelector(':scope > div')?.children ?? [];
  const badge = cells[0]?.textContent.trim() ?? '';
  const name = cells[1]?.textContent.trim() ?? '';
  const price = cells[2]?.textContent.trim() ?? '';
  const description = cells[3]?.textContent.trim() ?? '';
  const ctaLabel = cells[4]?.querySelector('a')?.textContent.trim()
    || cells[4]?.textContent.trim() || '';
  const ctaHref = readHref(cells[4]);

  const card = document.createElement('div');
  card.className = 'pick-card';

  const well = document.createElement('div');
  well.className = 'pick-well';
  if (badge) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'pick-badge';
    badgeEl.textContent = badge;
    well.append(badgeEl);
  }
  const stack = document.createElement('div');
  stack.className = 'pick-stack';
  STACK_COLORS.forEach((color) => {
    const brick = document.createElement('span');
    brick.className = 'pick-brick';
    brick.style.setProperty('--brick-color', color);
    stack.append(brick);
  });
  well.append(stack);

  const body = document.createElement('div');
  body.className = 'pick-body';

  const titleRow = document.createElement('div');
  titleRow.className = 'pick-titlerow';
  if (name) {
    const nameEl = document.createElement('h3');
    nameEl.className = 'pick-name';
    nameEl.textContent = name;
    titleRow.append(nameEl);
  }
  if (price) {
    const priceEl = document.createElement('span');
    priceEl.className = 'pick-price';
    priceEl.textContent = price;
    titleRow.append(priceEl);
  }
  body.append(titleRow);

  if (description) {
    const descEl = document.createElement('p');
    descEl.className = 'pick-desc';
    descEl.textContent = description;
    body.append(descEl);
  }

  if (ctaLabel) {
    const cta = document.createElement('a');
    cta.className = 'pick-add button primary';
    cta.href = ctaHref;
    cta.textContent = ctaLabel;
    body.append(cta);
  }

  card.append(well, body);
  block.textContent = '';
  block.append(card);
}
