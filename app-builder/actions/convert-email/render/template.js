import { escapeText } from '../escape.js';

// Minimal mustache-like engine: {{path}} (escaped), {{{path}}} (raw), {{#each path}}...
// {{/each}}, {{#eachChunk path size}}...{{/eachChunk}}. No conditionals, no partials, no
// scope-chain fallback to an outer context on a miss inside a loop — every added primitive
// is one more thing a site-authored template could misuse, and the block layouts this needs
// to express (a single fragment, N columns, N-up card grids) don't need more than this.
// Site templates never execute code; this only ever substitutes and iterates over data the
// action already produced (contentToMjml'd fragments), so nothing here is a trust boundary.

function resolvePath(scope, path) {
  if (path === 'this') return scope;
  return path.split('.').reduce((v, key) => (v == null ? undefined : v[key]), scope);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// template[searchFrom:] is the content right after an opening {{#<tagName> ...}}. Scans
// forward for that tag's matching {{/<tagName>}}, tracking nesting depth so a tag can
// contain another block of the *same* name (e.g. #each inside #each) — but note none of
// this engine's own blocks currently nest inside the same block type; eachChunk's own
// {{#each this}} is a different tag name, so no depth-tracking is even exercised by the
// four real templates. Kept general anyway since a site template nesting #each inside
// #each is a reasonable thing to want.
function extractBlock(template, tagName, searchFrom) {
  const tagRe = new RegExp(`{{#${tagName}\\b[^}]*}}|{{/${tagName}}}`, 'g');
  tagRe.lastIndex = searchFrom;
  let depth = 1;
  let match = tagRe.exec(template);
  while (match) {
    depth += match[0].startsWith('{{#') ? 1 : -1;
    if (depth === 0) {
      return { inner: template.slice(searchFrom, match.index), afterEnd: match.index + match[0].length };
    }
    match = tagRe.exec(template);
  }
  throw new Error(`template: unclosed {{#${tagName}}}`);
}

const TAG_PATTERN = '{{{\\s*([\\w.]+)\\s*}}}'
  + '|{{#each\\s+([\\w.]+)\\s*}}'
  + '|{{#eachChunk\\s+([\\w.]+)\\s+(\\d+)\\s*}}'
  + '|{{\\s*([\\w.]+)\\s*}}';

export function renderTemplate(template, scope) {
  const tagRe = new RegExp(TAG_PATTERN, 'g');
  let out = '';
  let lastIndex = 0;
  let match = tagRe.exec(template);
  while (match) {
    out += template.slice(lastIndex, match.index);
    const [full, rawPath, eachPath, chunkPath, chunkSize, escPath] = match;

    if (rawPath !== undefined) {
      out += String(resolvePath(scope, rawPath) ?? '');
      lastIndex = match.index + full.length;
    } else if (eachPath !== undefined) {
      const { inner, afterEnd } = extractBlock(template, 'each', tagRe.lastIndex);
      const items = resolvePath(scope, eachPath) || [];
      out += items.map((item) => renderTemplate(inner, item)).join('');
      lastIndex = afterEnd;
      tagRe.lastIndex = afterEnd;
    } else if (chunkPath !== undefined) {
      const { inner, afterEnd } = extractBlock(template, 'eachChunk', tagRe.lastIndex);
      const items = resolvePath(scope, chunkPath) || [];
      const chunks = chunk(items, Number(chunkSize));
      out += chunks.map((c) => renderTemplate(inner, c)).join('');
      lastIndex = afterEnd;
      tagRe.lastIndex = afterEnd;
    } else {
      out += escapeText(String(resolvePath(scope, escPath) ?? ''));
      lastIndex = match.index + full.length;
    }

    match = tagRe.exec(template);
  }
  out += template.slice(lastIndex);
  return out;
}
