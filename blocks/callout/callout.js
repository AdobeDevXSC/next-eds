// Callout — portable OOTB presentation block (Tier 1). One row, two cells: an icon/emoji and
// the message. Variant classes (info/warning/success) tint the border via callout.css.
export default function decorate(block) {
  const cells = block.querySelector(':scope > div')?.children ?? [];
  const icon = document.createElement('span');
  icon.className = 'callout-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = cells[0]?.innerHTML ?? '';
  const body = document.createElement('div');
  body.className = 'callout-body';
  body.innerHTML = cells[1]?.innerHTML ?? '';
  block.textContent = '';
  block.append(icon, body);
}
