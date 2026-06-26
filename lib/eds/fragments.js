import { parse } from 'node-html-parser';
import { fetchPlainHtml } from './fetch.js';

// Fetch + split the /nav fragment into the three EDS sections (brand, sections, tools).
export async function getNav() {
  try {
    const divs = parse(await fetchPlainHtml('nav')).childNodes.filter((n) => n.tagName === 'DIV');
    return {
      brand: divs[0]?.innerHTML.trim() ?? '',
      sections: divs[1]?.innerHTML.trim() ?? '',
      tools: divs[2]?.innerHTML.trim() ?? '',
    };
  } catch {
    return null;
  }
}

// Fetch the /footer fragment body.
export async function getFooter() {
  try {
    return (await fetchPlainHtml('footer')).trim();
  } catch {
    return null;
  }
}
