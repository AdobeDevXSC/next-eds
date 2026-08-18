import { parse } from 'node-html-parser';

// Parse the authored /footer fragment (DA-authored, see da footer.html) into a structured model
// the SiteFooter component renders: signup copy, link groups, an optional hours callout, and the
// legal bar. Sections are identified by content (not fixed position) so authors can reorder them.
// Degrades gracefully: a section it can't classify is skipped; a footer with only a legal bar
// (e.g. before the new content is previewed) still returns a valid model.

function linksFrom(el) {
  if (!el) return [];
  return el.querySelectorAll('a').map((a) => ({
    label: a.text.trim(),
    href: a.getAttribute('href') || '#',
  }));
}

/**
 * @param {string|null} html delivered /footer .plain.html
 * @returns {{signup:{heading:string,body:string,finePrintHtml:string}|null,
 *   groups:{heading:string,links:{label:string,href:string}[]}[],
 *   callout:{label:string,value:string}|null,
 *   legal:{copyright:string,links:{label:string,href:string}[]}|null}|null}
 */
export function parseFooter(html) {
  if (!html) return null;
  const root = parse(html);
  const sections = root.childNodes.filter((n) => n.tagName === 'DIV');

  const model = {
    signup: null, groups: [], callout: null, legal: null,
  };

  sections.forEach((sec) => {
    if (sec.querySelector('.metadata')) return; // skip section-metadata blocks

    const h2 = sec.querySelector('h2');
    const h3s = sec.querySelectorAll('h3');
    const paras = sec.querySelectorAll('p');

    // signup: the section with the headline
    if (h2) {
      model.signup = {
        heading: h2.text.trim(),
        body: paras[0]?.text.trim() ?? '',
        finePrintHtml: paras[1]?.innerHTML.trim() ?? '',
      };
      return;
    }

    // link groups: h3 heading + following ul, repeated
    if (h3s.length) {
      let current = null;
      sec.childNodes.filter((n) => n.tagName).forEach((child) => {
        if (child.tagName === 'H3') {
          current = { heading: child.text.trim(), links: [] };
          model.groups.push(current);
        } else if (child.tagName === 'UL' && current) {
          current.links = linksFrom(child);
        }
      });
      return;
    }

    // legal: the section whose copy starts with "Copyright"
    const copyP = paras.find((p) => /copyright/i.test(p.text));
    if (copyP) {
      const linkP = paras.find((p) => p.querySelector('a'));
      model.legal = { copyright: copyP.text.trim(), links: linksFrom(linkP) };
      return;
    }

    // callout (hours): the remaining two-paragraph section
    if (paras.length >= 2) {
      model.callout = { label: paras[0].text.trim(), value: paras[1].text.trim() };
    }
  });

  return model;
}
