import { EDS_ORIGIN } from './fetch.js';

/**
 * Normalize a link href or feed path to a comparable page path:
 * strip origin, query, and hash; ensure a leading slash; drop a trailing slash (except root).
 * @param {string} href
 * @returns {string}
 */
export function normalizePath(href = '') {
  if (!href) return '';
  let p = href.split('#')[0].split('?')[0];
  if (/^https?:\/\//i.test(p)) {
    try { p = new URL(p).pathname; } catch { return ''; }
  }
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p;
}

/**
 * Fetch the EDS query-index feed and index it by normalized path. Returns an empty Map if the
 * feed is missing or malformed, so callers degrade gracefully.
 * @returns {Promise<Map<string, {path:string,title:string,description:string,image:string}>>}
 */
export async function fetchQueryIndex() {
  try {
    const res = await fetch(`${EDS_ORIGIN}/query-index.json`, {
      next: { revalidate: 3600, tags: ['pages'] },
    });
    if (!res.ok) return new Map();
    const { data = [] } = await res.json();
    const map = new Map();
    data.forEach((row) => {
      if (row?.path) map.set(normalizePath(row.path), row);
    });
    return map;
  } catch {
    return new Map();
  }
}
