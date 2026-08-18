import { parse } from 'node-html-parser';
import { escapeAttr } from './escape.js';

function absolutize(url, origin) {
  if (!url) return url;
  const v = url.trim();
  if (/^(https?:)?\/\//i.test(v) || /^(mailto:|tel:|#|data:)/i.test(v)) return v;
  if (v.startsWith('/')) return `${origin}${v}`;
  if (v.startsWith('./')) return `${origin}/${v.slice(2)}`;
  return `${origin}/${v}`;
}

export function normalizeHtml(html, origin) {
  if (!html) return '';
  const root = parse(html);

  // <picture> → <img> (email needs one static, absolute image, not srcset sources).
  root.querySelectorAll('picture').forEach((pic) => {
    const img = pic.querySelector('img');
    const src = absolutize(img?.getAttribute('src') || '', origin);
    const alt = img?.getAttribute('alt') || '';
    pic.insertAdjacentHTML('afterend', `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" />`);
    pic.remove();
  });

  // Strip scripts.
  root.querySelectorAll('script').forEach((s) => s.remove());

  // Absolutize remaining src/href. getAttribute() returns the decoded value, and
  // toString() does not encode on the way out, so re-entity-encode before writing back
  // (escapeAttr) or a literal & (e.g. a multi-param query string) serializes as invalid,
  // unescaped HTML.
  root.querySelectorAll('[src]').forEach((el) => el.setAttribute('src', escapeAttr(absolutize(el.getAttribute('src'), origin))));
  root.querySelectorAll('[href]').forEach((el) => el.setAttribute('href', escapeAttr(absolutize(el.getAttribute('href'), origin))));

  return root.toString();
}

export function normalizeTree(tree, origin) {
  tree.forEach((section) => {
    section.children.forEach((node) => {
      if (node.kind === 'default') {
        node.html = normalizeHtml(node.html, origin);
      } else if (node.kind === 'block') {
        node.rows = (node.rows || []).map((row) => row.map((cell) => ({
          ...cell,
          html: normalizeHtml(cell.html, origin),
        })));
      }
    });
  });
  return tree;
}
