import { parse } from 'node-html-parser';
import { EDS_ORIGIN } from './fetch.js';

// Public host the static site is served from. Used to set a canonical URL that points at
// THIS surface (not the EDS origin), resolving the duplicate-content risk. Optional.
const SITE_URL = process.env.SITE_URL || '';

// Fetch the full EDS-rendered page (not .plain.html) so we can read its <head>, which EDS
// generates from the page's metadata block (title, description, Open Graph, …).
async function fetchPageHtml(slug) {
  const res = await fetch(`${EDS_ORIGIN}/${slug}`);
  if (!res.ok) return '';
  return res.text();
}

// Map the EDS <head> into a Next.js Metadata object, baked into the static HTML at build time.
export async function buildMetadata(slug = '') {
  const html = await fetchPageHtml(slug);
  if (!html) return {};
  const head = parse(html).querySelector('head');
  const attr = (sel, name = 'content') => head?.querySelector(sel)?.getAttribute(name);

  const title = head?.querySelector('title')?.text?.trim();
  const description = attr('meta[name="description"]');
  const ogImage = attr('meta[property="og:image"]');
  const canonicalPath = `/${slug}`;

  const metadata = {
    title,
    description,
    openGraph: {
      title: attr('meta[property="og:title"]') || title,
      description: attr('meta[property="og:description"]') || description,
      images: ogImage ? [ogImage] : undefined,
      url: SITE_URL ? `${SITE_URL}${canonicalPath}` : undefined,
    },
  };

  if (SITE_URL) {
    metadata.metadataBase = new URL(SITE_URL);
    metadata.alternates = { canonical: canonicalPath };
  }
  return metadata;
}

// Pages to prerender. This site has no query-index.json, so enumerate the index for now.
// A production build would read a sitemap / query-index and map its `.data[].path` entries.
export async function listPages() {
  return [''];
}
