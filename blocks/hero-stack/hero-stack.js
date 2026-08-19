// Hero Stack — portable OOTB presentation block (Tier 1). Reproduces the designed home hero
// (the annotated ingredient stack) on the raw EDS runtime so it matches the Next/RSC home.
// Authored content: an overline <p>, the wordmark <h1>, a tagline <p>, and a <p> with the two
// CTA links. The annotated stack itself is a fixed brand illustration, baked here from the
// design source (content/home.json → heroStack), so authors edit words, not hex codes.

const STACK = {
  countLabel: 'six bricks',
  total: '$12.50',
  rows: [
    {
      labelD: 'ciabatta · top', labelM: 'ciabatta · top', price: '$2.75', color: '#E7C288', hD: 30, hM: 22, radius: '16px 16px 4px 4px',
    },
    {
      labelD: 'maple-pepper glaze', labelM: 'glaze', price: '+$1.00', color: '#B98A3C', hD: 12, hM: 10, radius: '3px',
    },
    {
      labelD: 'roasted turkey', labelM: 'turkey', price: '+$4.00', color: '#D9A273', hD: 22, hM: 16, radius: '4px',
    },
    {
      labelD: 'provolone', labelM: 'provolone', price: '+$1.25', color: '#F2C14E', hD: 14, hM: 11, radius: '3px',
    },
    {
      labelD: 'lettuce', labelM: 'lettuce', price: '+$0.75', color: '#6E8F4A', hD: 11, hM: 9, radius: '3px',
    },
    {
      labelD: 'ciabatta · base', labelM: 'ciabatta · base', price: '$2.75', color: '#E7C288', hD: 32, hM: 24, radius: '4px 4px 16px 16px', base: true,
    },
  ],
};

function buildAnnotated() {
  const annotated = document.createElement('div');
  annotated.className = 'annotated';

  const ul = document.createElement('ul');
  ul.className = 'annotated-rows';
  STACK.rows.forEach((r) => {
    const li = document.createElement('li');
    li.className = 'annotated-row';

    const labelD = document.createElement('span');
    labelD.className = 'anno-label anno-label-d';
    labelD.textContent = r.labelD;

    const labelM = document.createElement('span');
    labelM.className = 'anno-label anno-label-m';
    labelM.textContent = r.labelM;

    const brick = document.createElement('span');
    brick.className = `anno-brick${r.base ? ' anno-brick-base' : ''}`;
    brick.style.setProperty('--brick-color', r.color);
    brick.style.setProperty('--h-d', `${r.hD}px`);
    brick.style.setProperty('--h-m', `${r.hM}px`);
    brick.style.setProperty('--brick-radius', r.radius);

    const price = document.createElement('span');
    price.className = 'anno-price';
    price.textContent = r.price;

    li.append(labelD, labelM, brick, price);
    ul.append(li);
  });

  const total = document.createElement('div');
  total.className = 'annotated-total';
  const count = document.createElement('span');
  count.className = 'anno-count';
  count.textContent = STACK.countLabel;
  const val = document.createElement('span');
  val.className = 'anno-total-val';
  val.textContent = STACK.total;
  total.append(count, val);

  annotated.append(ul, total);
  return annotated;
}

/**
 * loads and decorates the hero-stack block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const cell = block.querySelector(':scope > div > div');
  const nodes = cell ? [...cell.children] : [];

  const wordmark = nodes.find((n) => n.tagName === 'H1');
  const ctaPara = nodes.find((n) => n.tagName === 'P' && n.querySelector('a'));
  const textParas = nodes.filter((n) => n.tagName === 'P' && n !== ctaPara);
  const overline = textParas[0];
  const tagline = textParas[1];

  const inner = document.createElement('div');
  inner.className = 'hs-inner';

  if (overline) {
    overline.className = 'overline';
    inner.append(overline);
  }
  if (wordmark) {
    wordmark.className = 'wordmark';
    inner.append(wordmark);
  }
  if (tagline) {
    tagline.className = 'hero-tagline';
    inner.append(tagline);
  }

  inner.append(buildAnnotated());

  if (ctaPara) {
    ctaPara.className = 'hero-ctas';
    const links = [...ctaPara.querySelectorAll('a')];
    links.forEach((a, i) => {
      a.classList.add('btn', i === 0 ? 'btn-primary' : 'btn-ghost');
    });
    inner.append(ctaPara);
  }

  block.textContent = '';
  block.append(inner);
}
