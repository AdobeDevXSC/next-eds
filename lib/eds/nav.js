import { parse } from 'node-html-parser';
import { normalizePath } from './queryIndex.js';

// Request a smaller rendition for menu imagery (the feed image defaults to width=1200).
function sizeImage(url, width) {
  if (!url) return '';
  try {
    const u = new URL(url);
    u.searchParams.set('width', String(width));
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Parse the EDS nav "sections" HTML into a tree of top-level items with their child links.
 * Shape: [{ label, href, children: [{ label, href }] }]
 * @param {string} sectionsHtml inner HTML of the nav sections column
 */
export function parseNav(sectionsHtml = '') {
  const root = parse(sectionsHtml);
  const topUl = root.childNodes.find((n) => n.tagName === 'UL');
  if (!topUl) return [];

  return topUl.childNodes
    .filter((n) => n.tagName === 'LI')
    .map((li) => {
      // The top-level link is the first anchor (inside a <p>); the submenu is a nested <ul>.
      const top = li.querySelector('a');
      const childUl = li.childNodes.find((n) => n.tagName === 'UL');
      const children = childUl
        ? childUl.childNodes
          .filter((n) => n.tagName === 'LI')
          .map((cli) => {
            const a = cli.querySelector('a');
            return { label: a?.text?.trim() ?? '', href: a?.getAttribute('href') ?? '' };
          })
          .filter((c) => c.label)
        : [];
      return {
        label: top?.text?.trim() ?? '',
        href: top?.getAttribute('href') ?? '',
        children,
      };
    })
    .filter((item) => item.label);
}

/**
 * Enrich each child link with its query-index metadata (title/description/image) so the
 * mega-menu can render a featured panel. Links without a feed entry (external, hash anchors)
 * keep just their label + href.
 * @param {ReturnType<typeof parseNav>} tree
 * @param {Map} indexMap from fetchQueryIndex()
 */
export function enrichNav(tree, indexMap) {
  return tree.map((item) => ({
    ...item,
    children: item.children.map((c) => {
      const row = indexMap.get(normalizePath(c.href));
      return {
        ...c,
        title: row?.title || c.label,
        description: row?.description || '',
        image: sizeImage(row?.image || '', 640),
      };
    }),
  }));
}
