// Content origin for EDS-delivered markup. Point at *.aem.page (preview) or *.aem.live (published).
const EDS_ORIGIN = process.env.EDS_ORIGIN || 'https://main--next-eds--AdobeDevXSC.aem.page';

/**
 * Fetch the delivered semantic HTML body for a page (the same artifact aem.js decorates).
 * @param {string} slug e.g. '' for index, or 'path/to/page'
 * @returns {Promise<string|null>} the raw .plain.html body, or null if the page doesn't exist (404)
 */
export async function fetchPlainHtml(slug = '') {
  const path = slug ? `${slug}.plain.html` : 'index.plain.html';
  const res = await fetch(`${EDS_ORIGIN}/${path}`, {
    // ISR: cache and revalidate. Production would purge via a publish webhook + revalidateTag.
    next: { revalidate: 60, tags: [`page:${slug || 'index'}`] },
  });
  // A missing page (or a non-page request like /favicon.ico) → let the caller 404, not 500.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`EDS fetch failed: ${res.status} for /${path}`);
  const html = await res.text();
  // Delivered markup uses relative asset URLs (./media_…) that must resolve against
  // the EDS origin, not the Next.js page URL.
  return html.replace(/(src|srcset)="\.\//g, `$1="${EDS_ORIGIN}/`);
}

export { EDS_ORIGIN };
