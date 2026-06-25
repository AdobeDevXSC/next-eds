import { fetchPlainHtml } from '../../lib/eds/fetch.js';
import { parseEds } from '../../lib/eds/parse.js';
import { renderNode } from '../../lib/eds/render.js';
import { buildMetadata, listPages } from '../../lib/eds/metadata.js';

// Enumerate the pages to prerender for the static export.
export async function generateStaticParams() {
  const paths = await listPages();
  return paths.map((p) => ({ slug: p ? p.split('/') : [] }));
}

// Bake the <head> (title, description, canonical, Open Graph) into the static HTML.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  return buildMetadata((slug ?? []).join('/'));
}

// Catch-all route: any path → fetch EDS .plain.html → parse → render via block registry.
// A React Server Component, so static content ships zero client-side JavaScript.
export default async function Page({ params }) {
  const { slug } = await params;
  const path = (slug ?? []).join('/');

  const html = await fetchPlainHtml(path);
  const tree = parseEds(html);

  return <main>{tree.map((node, i) => renderNode(node, i))}</main>;
}
