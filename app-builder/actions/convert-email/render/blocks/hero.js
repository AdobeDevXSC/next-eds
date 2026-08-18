import { contentToMjml } from './content.js';

export function renderHero(block) {
  const html = block.rows?.[0]?.[0]?.html || '';
  return `<mj-section padding="0"><mj-column>${contentToMjml(html)}</mj-column></mj-section>`;
}
