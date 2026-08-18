import { parse } from 'node-html-parser';

// Server-side port of the client `decorateButtons()` in scripts.js. The classic EDS path adds
// button classes in the browser; the RSC path renders default content as static HTML, so a
// standalone call-to-action link never became a button. This restores that convention at render
// time: a link that is the sole content of a <p> and carries authored emphasis becomes a button —
// **bold** → primary, *italic* → secondary, ***both*** → accent. Anything else is left untouched.
export function decorateButtonsHtml(html) {
  if (!html || !html.includes('<a')) return html;
  try {
    const root = parse(html);
    let changed = false;
    root.querySelectorAll('p a[href]').forEach((a) => {
      const p = a.closest('p');
      if (!p) return;
      const text = a.text.trim();
      if (!text || a.querySelector('img')) return; // image link, not a button
      if (p.text.trim() !== text) return; // the link isn't the whole paragraph
      const strong = a.closest('strong');
      const em = a.closest('em');
      if (!strong && !em) return; // require authored emphasis, like aem.js

      const variant = strong && em ? 'accent' : strong ? 'primary' : 'secondary';
      a.setAttribute('class', `button ${variant}`);
      p.setAttribute('class', 'button-wrapper');

      // Lift the <a> out of its emphasis wrapper(s) — the wrapper is the direct child of the <p>.
      let outer = a;
      while (outer.parentNode && outer.parentNode !== p) outer = outer.parentNode;
      if (outer !== a) outer.replaceWith(a);
      changed = true;
    });
    return changed ? root.toString() : html;
  } catch {
    return html; // never let decoration break rendering
  }
}
