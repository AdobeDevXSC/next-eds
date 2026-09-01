import { renderShell } from './shell.js';
import { renderDefault } from './blocks/default.js';
import { fetchBlockTemplate, buildTemplateData } from './dynamic-block.js';
import { renderTemplate } from './template.js';

// Blocks with no content-only representation at all — inherently interactive/JS-dependent,
// so no template (site-authored or otherwise) could make them work in an email client that
// can't run JS. Always omitted, before even attempting a template fetch.
const NON_CONTENT_BLOCKS = ['form', 'search', 'modal', 'embed'];

// A block with no site-hosted template still shouldn't be silently dropped — flatten all
// its cells, in document order, through the same contentToMjml a plain content section
// uses. This is the "just works" path for any block a site hasn't (yet) written a bespoke
// email layout for, including one added after this action was last deployed.
function renderGeneric(block) {
  const html = (block.rows || []).flatMap((cells) => cells.map((cell) => cell.html)).join('');
  return renderDefault({ html });
}

export async function renderDocument(tree, { preheader = '', origin } = {}) {
  const warnings = [];
  const blocksRendered = [];
  const parts = [];
  // Per-request only: one template fetch per distinct block name, however many times that
  // block occurs on the page — not a cross-request cache (this action has none).
  const templateCache = new Map();
  const getTemplate = async (name) => {
    if (!templateCache.has(name)) templateCache.set(name, await fetchBlockTemplate(name, origin));
    return templateCache.get(name);
  };

  for (const section of tree) {
    for (const node of section.children) {
      if (node.kind === 'default') {
        parts.push(renderDefault(node));
        continue;
      }

      if (NON_CONTENT_BLOCKS.includes(node.name)) {
        warnings.push(`block '${node.name}' omitted (not emailable)`);
        continue;
      }

      try {
        // eslint-disable-next-line no-await-in-loop -- sequential by design: keeps
        // warnings/blocksRendered in deterministic document order, and a page has few
        // enough distinct block types that parallelizing isn't worth the complexity.
        const template = await getTemplate(node.name);
        const fragment = template === null
          ? renderGeneric(node)
          : renderTemplate(template, buildTemplateData(node));
        if (fragment) {
          parts.push(fragment);
          blocksRendered.push(node.name);
        }
      } catch (err) {
        warnings.push(`block '${node.name}' failed to render: ${err.message}`);
      }
    }
  }

  return { mjml: renderShell({ body: parts.join('\n'), preheader }), warnings, blocksRendered };
}
