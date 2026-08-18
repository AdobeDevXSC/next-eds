import { fetchPlainHtml } from './fetch.js';

// Fetch the /footer fragment body.
export async function getFooter() {
  try {
    return (await fetchPlainHtml('footer'))?.trim() ?? null;
  } catch {
    return null;
  }
}
