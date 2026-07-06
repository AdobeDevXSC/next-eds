import { parse } from 'node-html-parser';

// This is the "parse/normalize" half of aem.js, reimplemented as pure functions that
// PRODUCE DATA instead of mutating the DOM. The "load/decorate" half is replaced by React.

/**
 * @typedef {{ html: string, pictureOnly: boolean }} Cell
 * @typedef {{ kind: 'section', styles: string[], children: Node[] }} SectionNode
 * @typedef {{ kind: 'block', name: string, variants: string[], rows: Cell[][], html: string }} BlockNode
 * @typedef {{ kind: 'default', html: string }} DefaultNode
 * @typedef {SectionNode | BlockNode | DefaultNode} Node
 */

/** A block element is a <div> whose first class names the block (e.g. class="hero"). */
function isBlock(el) {
  return el.tagName === 'DIV' && el.classList.length > 0;
}

// All DOM inspection lives here, so block components stay pure/dependency-free. Each cell
// carries its inner HTML plus generic hints (e.g. pictureOnly — a cell whose sole element is
// a picture, which several blocks treat as an "image cell").
function parseCell(cell) {
  const elementChildren = cell.childNodes.filter((n) => n.tagName);
  return {
    html: cell.innerHTML.trim(),
    pictureOnly: elementChildren.length === 1 && !!cell.querySelector('picture'),
  };
}

/** Normalize one block <div> into name + variants + a grid of cells. */
function parseBlock(el) {
  const [name, ...variants] = el.classList.value;
  const rows = el.childNodes
    .filter((n) => n.tagName === 'DIV')
    .map((row) => row.childNodes
      .filter((c) => c.tagName === 'DIV')
      .map(parseCell));
  // Keep the block's original inner markup verbatim. rows only capture the div grid
  // (what ported components consume); html preserves everything — including any
  // non-grid content — so the classic/fallback path never drops what it can't model.
  return { kind: 'block', name, variants, rows, html: el.innerHTML.trim() };
}

/** Parse delivered .plain.html into a normalized section/block/default-content tree. */
export function parseEds(html) {
  const root = parse(html);
  const sectionEls = root.childNodes.filter((n) => n.tagName === 'DIV');

  return sectionEls.map((sectionEl) => ({
    kind: 'section',
    // Section Metadata "Style" is delivered as class names on the section <div>
    // (e.g. <div class="highlight">). Native aem.js keeps these; carry them through.
    styles: sectionEl.classList.value,
    children: sectionEl.childNodes
      .filter((n) => n.tagName) // drop whitespace text nodes
      .map((el) => (isBlock(el)
        ? parseBlock(el)
        : { kind: 'default', html: el.outerHTML })),
  }));
}
