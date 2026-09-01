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

// Lets a caller point this action at a different EDS site by org+repo (e.g. the tools/email
// preview tool passing along whatever site DA told it to browse), rather than only the site
// baked into this deployment's own manifest defaults. `main` (the branch) is not itself
// parameterized here — only env (preview/live) selects between .aem.page and .aem.live, same
// as the rest of this action. Restricted to alphanumeric + hyphen — matches this deployment's
// own default (main--next-eds--AdobeDevXSC.aem.page — GitHub org names are case-sensitive and
// AdobeDevXSC is mixed-case, so this must allow uppercase too, verified against the real
// deployed action after an earlier lowercase-only version rejected that exact org name) — so
// org/repo can never smuggle extra path segments or a different host into the constructed
// origin (e.g. a `../`-style value). Returns null on anything else, which the caller should
// treat as a 400, not a silent fallback to the default site.
const SAFE_ORG_REPO = /^[a-zA-Z0-9-]+$/;

export function buildOriginsFromOrgRepo(org, repo) {
  if (!SAFE_ORG_REPO.test(org || '') || !SAFE_ORG_REPO.test(repo || '')) return null;
  return {
    preview: `https://main--${repo}--${org}.aem.page`,
    live: `https://main--${repo}--${org}.aem.live`,
  };
}

export { DEFAULT_ORIGINS };
