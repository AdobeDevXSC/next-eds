import { fetchQueryIndex, normalizePath } from './queryIndex.js';

// Build Next.js metadata for a page from the EDS query-index — title, description, and
// og:image, all authored via the page's Metadata block and indexed by helix-query.yaml.
// Returns {} when the page isn't in the feed (unpublished / excluded), so the root layout's
// default title/description apply.
export async function buildMetadata(pathSlug = '') {
  const map = await fetchQueryIndex();
  const row = map.get(normalizePath(`/${pathSlug}`));
  if (!row) return {};

  const meta = {};
  if (row.title) meta.title = row.title;
  if (row.description) meta.description = row.description;

  const openGraph = {};
  if (row.title) openGraph.title = row.title;
  if (row.description) openGraph.description = row.description;
  if (row.image) openGraph.images = [{ url: row.image }];
  if (Object.keys(openGraph).length) meta.openGraph = openGraph;

  return meta;
}
