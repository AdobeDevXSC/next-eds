import { renderShell } from './shell.js';
import { renderDefault } from './blocks/default.js';
import { renderHero } from './blocks/hero.js';
import { renderCards } from './blocks/cards.js';
import { renderColumns } from './blocks/columns.js';
import { renderCallout } from './blocks/callout.js';

const BLOCKS = {
  hero: renderHero,
  cards: renderCards,
  columns: renderColumns,
  callout: renderCallout,
};

export function renderDocument(tree, { preheader = '' } = {}) {
  const warnings = [];
  const blocksRendered = [];
  const parts = [];

  tree.forEach((section) => {
    section.children.forEach((node) => {
      if (node.kind === 'default') {
        parts.push(renderDefault(node));
        return;
      }
      const renderer = BLOCKS[node.name];
      if (!renderer) {
        warnings.push(`block '${node.name}' omitted (not emailable)`);
        return;
      }
      try {
        const fragment = renderer(node);
        if (fragment) { parts.push(fragment); blocksRendered.push(node.name); }
      } catch (err) {
        warnings.push(`block '${node.name}' failed to render: ${err.message}`);
      }
    });
  });

  return { mjml: renderShell({ body: parts.join('\n'), preheader }), warnings, blocksRendered };
}
