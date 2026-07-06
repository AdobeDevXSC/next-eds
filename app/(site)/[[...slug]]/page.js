import { notFound } from 'next/navigation';
import { fetchPlainHtml } from '../../../lib/eds/fetch.js';
import { fetchQueryIndex } from '../../../lib/eds/queryIndex.js';
import { parseEds } from '../../../lib/eds/parse.js';
import { renderNode } from '../../../lib/eds/render.js';

// Pre-render every published page at build time from the EDS query-index feed (SSG). Pages
// not in the feed (or added later) still resolve on demand via ISR, since dynamicParams
// defaults to true. fetchQueryIndex pages through the whole feed, so every published page is
// prerendered even once the site outgrows one query-index window.
export async function generateStaticParams() {
  const map = await fetchQueryIndex();
  // Map keys are normalized paths ('/', '/foo/bar'); turn each into a slug segment array.
  return [...map.keys()].map((p) => ({ slug: p.split('/').filter(Boolean) }));
}

// Catch-all route: any path → fetch EDS .plain.html → parse → render via block registry.
// A React Server Component, so static content ships zero client-side JavaScript.
export default async function Page({ params }) {
  const { slug } = await params;
  const path = (slug ?? []).join('/');

  const html = await fetchPlainHtml(path);
  if (html === null) notFound(); // missing page / non-page request → 404, not 500

  const tree = parseEds(html);

  return <main>{tree.map((node, i) => renderNode(node, i))}</main>;
}
