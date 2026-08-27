// Two Ways — portable OOTB presentation block (Tier 1). Reproduces the Next/RSC home's "Two ways
// to lunch" rows on the raw EDS runtime so it matches the Next/RSC home. Authored content: 2
// rows, each [title, description, CTA label, CTA href]. The per-row index label/color and the
// brick "specimen" bars are a fixed brand illustration, baked here from the design source
// (content/home.json → twoWays), so authors edit words, not hex codes. The <h2> section heading
// is authored as default content in the section (styled by styles/styles.css's
// .section.home-section), not part of this block.
const DECOR = [
  {
    index: 'A',
    indexColor: 'primary-deep',
    specimen: [
      { color: '#E0B678', height: 22 },
      { color: '#B04A3A', height: 34 },
      { color: '#F2C14E', height: 18 },
      { color: '#6E8F4A', height: 28 },
    ],
  },
  {
    index: 'B',
    indexColor: 'text-tertiary',
    specimen: [
      { color: '#6E8F4A', height: 14 },
      { color: '#8E4B33', height: 26 },
      { color: '#E7C288', height: 40 },
      { color: '#C2452D', height: 20 },
    ],
  },
];

function buildSpecimen(bricks) {
  const wrap = document.createElement('div');
  wrap.className = 'tw-specimen';
  bricks.forEach((b) => {
    const brick = document.createElement('span');
    brick.className = 'specimen-brick';
    brick.style.setProperty('--brick-color', b.color);
    brick.style.setProperty('--sh', `${b.height}px`);
    wrap.append(brick);
  });
  return wrap;
}

// A CTA href cell may be authored as a real link, or as a plain-text path (e.g. "/menu").
function readHref(cell) {
  const link = cell?.querySelector('a');
  if (link) return link.getAttribute('href') || '#';
  return cell?.textContent.trim() || '#';
}

/**
 * loads and decorates the two-ways block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'two-ways-rows';

  [...block.children].forEach((row, i) => {
    const cells = row.children;
    const decor = DECOR[i] ?? {};
    const li = document.createElement('li');
    li.className = 'two-ways-row';

    const index = document.createElement('span');
    index.className = `tw-index${decor.indexColor ? ` tw-index-${decor.indexColor}` : ''}`;
    index.textContent = decor.index ?? '';

    const body = document.createElement('div');
    body.className = 'tw-body';
    const title = document.createElement('div');
    title.className = 'tw-title';
    title.innerHTML = cells[0]?.innerHTML ?? '';
    const desc = document.createElement('div');
    desc.className = 'tw-desc';
    desc.innerHTML = cells[1]?.innerHTML ?? '';
    body.append(title, desc);

    const specimen = buildSpecimen(decor.specimen ?? []);

    const cta = document.createElement('a');
    cta.className = 'tw-cta';
    const label = cells[2]?.textContent.trim() ?? '';
    cta.textContent = `${label} →`;
    cta.href = readHref(cells[3]);

    li.append(index, body, specimen, cta);
    ul.append(li);
  });

  block.textContent = '';
  block.append(ul);
}
