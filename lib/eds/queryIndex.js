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
 * Fetch the entire EDS query-index feed and index it by normalized path.
 *
 * query-index.json is a paginated sheet (offset/limit/total), so we page through it to get
 * every row — a single request would only return one window once the site outgrows the page
 * size. Fetched fresh (no cache) so newly published or renamed pages appear immediately,
 * without any revalidation wiring. Returns an empty Map if the feed is missing or malformed,
 * so callers degrade gracefully.
 * @returns {Promise<Map<string, {path:string,title:string,description:string,image:string}>>}
 */
export async function fetchQueryIndex() {
  const map = new Map();
  try {
    const pageSize = 1000;
    let offset = 0;
    let total = Infinity;
    while (offset < total) {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(
        `${EDS_ORIGIN}/query-index.json?offset=${offset}&limit=${pageSize}`,
        { cache: 'no-store' },
      );
      if (!res.ok) break;
      // eslint-disable-next-line no-await-in-loop
      const json = await res.json();
      const rows = json.data ?? [];
      total = Number.isFinite(json.total) ? json.total : rows.length;
      rows.forEach((row) => {
        if (row?.path) map.set(normalizePath(row.path), row);
      });
      if (rows.length === 0) break; // guard against a bad total
      offset += rows.length;
    }
  } catch {
    // return whatever we collected (possibly empty)
  }
  return map;
}
