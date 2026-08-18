import { contentToMjml } from './content.js';

export function renderDefault(node) {
  return `<mj-section><mj-column>${contentToMjml(node.html)}</mj-column></mj-section>`;
}
