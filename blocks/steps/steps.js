// Steps — portable OOTB presentation block (Tier 1). Renders a numbered sequence; each row is
// [title | description].
export default function decorate(block) {
  const ol = document.createElement('ol');
  ol.className = 'steps-list';
  [...block.children].forEach((row, i) => {
    const cells = row.children;
    const li = document.createElement('li');
    li.className = 'steps-step';

    const num = document.createElement('span');
    num.className = 'steps-num';
    num.setAttribute('aria-hidden', 'true');
    num.textContent = String(i + 1);

    const body = document.createElement('div');
    body.className = 'steps-body';
    const title = document.createElement('div');
    title.className = 'steps-title';
    title.innerHTML = cells[0]?.innerHTML ?? '';
    const desc = document.createElement('div');
    desc.className = 'steps-desc';
    desc.innerHTML = cells[1]?.innerHTML ?? '';
    body.append(title, desc);

    li.append(num, body);
    ol.append(li);
  });
  block.textContent = '';
  block.append(ol);
}
