// Hero — portable OOTB presentation block (Tier 1). Renders natively on raw EDS and via
// LegacyBlock in Next. CSS layers the picture behind the heading/CTAs (hero.css).
export default function decorate(block) {
  const cell = block.querySelector(':scope > div > div');
  const content = document.createElement('div');
  content.className = 'hero-content';
  if (cell) content.innerHTML = cell.innerHTML;
  block.textContent = '';
  block.append(content);
}
