// How It Works — portable OOTB presentation block (Tier 1). Reproduces the Next/RSC home's "How
// it works" steps on the raw EDS runtime so it matches the Next/RSC home. Authored content: 4
// rows, each [title, description]. The step number (01–04) is baked from the row position,
// matching content/home.json's howItWorks.steps[].num — it is not authored. The <h2> section
// heading is authored as default content in the section (styled by styles/styles.css's
// .section.home-section), not part of this block.
export default function decorate(block) {
  const ol = document.createElement('ol');
  ol.className = 'hiw-steps';

  [...block.children].forEach((row, i) => {
    const cells = row.children;
    const li = document.createElement('li');
    li.className = `hiw-step${i === 0 ? ' hiw-step-first' : ''}`;

    const num = document.createElement('span');
    num.className = 'hiw-num';
    num.setAttribute('aria-hidden', 'true');
    num.textContent = String(i + 1).padStart(2, '0');

    const title = document.createElement('div');
    title.className = 'hiw-title';
    title.innerHTML = cells[0]?.innerHTML ?? '';

    const desc = document.createElement('div');
    desc.className = 'hiw-desc';
    desc.innerHTML = cells[1]?.innerHTML ?? '';

    li.append(num, title, desc);
    ol.append(li);
  });

  block.textContent = '';
  block.append(ol);
}
