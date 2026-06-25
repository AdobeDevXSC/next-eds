import { parse } from 'node-html-parser';

// This is the "parse/normalize" half of aem.js, reimplemented as pure functions that
// PRODUCE DATA instead of mutating the DOM. The "load/decorate" half is replaced by React.

/**
 * @typedef {{ kind: 'section', children: Node[] }} SectionNode
 * @typedef {{ kind: 'block', name: string, variants: string[], rows: string[][] }} BlockNode
 * @typedef {{ kind: 'default', html: string }} DefaultNode
 * @typedef {SectionNode | BlockNode | DefaultNode} Node
 */

/** A block element is a <div> whose first class names the block (e.g. class="hero"). */
function isBlock(el) {
  return el.tagName === 'DIV' && el.classList.length > 0;
}

/** Normalize one block <div> into name + variants + a grid of inner-HTML cells. */
function parseBlock(el) {
  const [name, ...variants] = el.classList.value;
  const rows = el.childNodes
    .filter((n) => n.tagName === 'DIV')
    .map((row) => row.childNodes
      .filter((c) => c.tagName === 'DIV')
      .map((cell) => cell.innerHTML.trim()));
  return { kind: 'block', name, variants, rows };
}

/** Parse delivered .plain.html into a normalized section/block/default-content tree. */
export function parseEds(html) {
  const root = parse(html);
  const sectionEls = root.childNodes.filter((n) => n.tagName === 'DIV');

  return sectionEls.map((sectionEl) => ({
    kind: 'section',
    children: sectionEl.childNodes
      .filter((n) => n.tagName) // drop whitespace text nodes
      .map((el) => (isBlock(el)
        ? parseBlock(el)
        : { kind: 'default', html: el.outerHTML })),
  }));
}
