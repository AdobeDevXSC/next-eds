import { contentToMjml } from './content.js';

const PER_ROW = 2;

export function renderCards(block) {
  const rows = block.rows || [];
  const columns = rows.map((cells) => {
    const html = cells.map((c) => c.html).join('');
    return `<mj-column>${contentToMjml(html)}</mj-column>`;
  });
  const sections = [];
  for (let i = 0; i < columns.length; i += PER_ROW) {
    sections.push(`<mj-section>${columns.slice(i, i + PER_ROW).join('')}</mj-section>`);
  }
  return sections.join('');
}
