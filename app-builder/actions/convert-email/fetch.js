// Fetch the delivered semantic .plain.html for an EDS page.
// Mirrors lib/eds/fetch.js's path/404 behavior, but env-selectable and
// dependency-free (URL rewriting is normalize.js's job, not this module's).

const DEFAULT_ORIGINS = {
  preview: 'https://main--next-eds--AdobeDevXSC.aem.page',
  live: 'https://main--next-eds--AdobeDevXSC.aem.live',
};

export function resolveOrigin(env, origins = DEFAULT_ORIGINS) {
  return env === 'live' ? origins.live : origins.preview;
}

export async function fetchPlainHtml(path = '', { env = 'preview', origins = DEFAULT_ORIGINS } = {}) {
  const clean = String(path).replace(/^\/+/, '');
  const rel = clean ? `${clean}.plain.html` : 'index.plain.html';
  const origin = resolveOrigin(env, origins);
  const res = await fetch(`${origin}/${rel}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`EDS fetch failed: ${res.status} for /${rel}`);
  return res.text();
}

export { DEFAULT_ORIGINS };
