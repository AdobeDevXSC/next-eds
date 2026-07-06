import { parse } from 'node-html-parser';
import { fetchPlainHtml } from './fetch.js';
import { parseNav } from './nav.js';

// Fetch + split the /nav fragment into brand (HTML), a structured sections tree, and tools (HTML).
export async function getNav() {
  try {
    const html = await fetchPlainHtml('nav');
    if (!html) return null;
    const divs = parse(html).childNodes.filter((n) => n.tagName === 'DIV');
    return {
      brand: divs[0]?.innerHTML.trim() ?? '',
      sections: parseNav(divs[1]?.innerHTML ?? ''),
      tools: divs[2]?.innerHTML.trim() ?? '',
    };
  } catch {
    return null;
  }
}

// Fetch the /footer fragment body.
export async function getFooter() {
  try {
    return (await fetchPlainHtml('footer'))?.trim() ?? null;
  } catch {
    return null;
  }
}
