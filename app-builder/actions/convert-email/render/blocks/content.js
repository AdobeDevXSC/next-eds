import { parse } from 'node-html-parser';
import { escapeAttr, escapeText } from '../../escape.js';

// A CTA paragraph: explicit button-container, or a <p> whose entire text is links.
function isButtonPara(el) {
  if (el.tagName !== 'P') return false;
  const links = el.querySelectorAll('a');
  if (links.length === 0) return false;
  if (el.classList.contains('button-container')) return true;
  if (links.some((a) => a.classList.contains('button'))) return true;
  const linkText = links.map((a) => a.textContent.trim()).join(' ').trim();
  return el.textContent.trim() === linkText;
}

export function contentToMjml(html) {
  const root = parse(html || '');
  const out = [];
  let buffer = [];
  const flush = () => {
    const inner = buffer.join('').trim();
    if (inner) out.push(`<mj-text>${inner}</mj-text>`);
    buffer = [];
  };
  root.childNodes.forEach((node) => {
    if (!node.tagName) { // text node
      // node.text decodes entities on read (node-html-parser), unlike the outerHTML
      // passthrough used for element children below, so it must be re-escaped here or
      // already-escaped author text (e.g. "&lt;script&gt;") would decode into live markup.
      if (node.text && node.text.trim()) buffer.push(escapeText(node.text));
      return;
    }
    const tag = node.tagName;
    if (tag === 'IMG' || tag === 'PICTURE') {
      flush();
      const img = tag === 'IMG' ? node : node.querySelector('img');
      const src = img?.getAttribute('src') || '';
      const alt = img?.getAttribute('alt') || '';
      out.push(`<mj-image src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" />`);
    } else if (isButtonPara(node)) {
      flush();
      node.querySelectorAll('a').forEach((a) => {
        const href = escapeAttr(a.getAttribute('href') || '#');
        const label = a.textContent.trim();
        const img = a.querySelector('img');
        if (!label && img) {
          // A linked image with no visible text (e.g. an EDS "linked image" CTA) — render
          // the image itself, as a clickable mj-image (mj-image supports its own `href`),
          // rather than an empty, label-less <mj-button> that would drop the image.
          out.push(`<mj-image src="${escapeAttr(img.getAttribute('src') || '')}" href="${href}" alt="${escapeAttr(img.getAttribute('alt') || '')}" />`);
        } else if (label) {
          out.push(`<mj-button href="${href}">${escapeText(label)}</mj-button>`);
        }
        // else: an <a> with neither visible text nor an image has nothing to render —
        // skip rather than emit an empty, useless <mj-button></mj-button>.
      });
    } else {
      buffer.push(node.outerHTML);
    }
  });
  flush();
  return out.join('');
}
