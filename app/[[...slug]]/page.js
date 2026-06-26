import { notFound } from 'next/navigation';
import { fetchPlainHtml } from '../../lib/eds/fetch.js';
import { parseEds } from '../../lib/eds/parse.js';
import { renderNode } from '../../lib/eds/render.js';

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
