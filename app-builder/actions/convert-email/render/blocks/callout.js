import { contentToMjml } from './content.js';

export function renderCallout(block) {
  const html = block.rows?.[0]?.[0]?.html || '';
  return `<mj-section background-color="#f4f4f4" padding="24px"><mj-column>${contentToMjml(html)}</mj-column></mj-section>`;
}
