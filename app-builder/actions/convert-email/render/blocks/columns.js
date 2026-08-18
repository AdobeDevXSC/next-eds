import { contentToMjml } from './content.js';

export function renderColumns(block) {
  const cells = block.rows?.[0] || [];
  if (cells.length === 0) return '';
  const columns = cells.map((c) => `<mj-column>${contentToMjml(c.html)}</mj-column>`).join('');
  return `<mj-section>${columns}</mj-section>`;
}
