import { NextResponse } from 'next/server';

// Tag each rendered page response with a deterministic Cloudflare cache tag derived from
// the URL: `page:<slug>`. This mirrors the Next data-cache tags set in lib/eds/fetch.js,
// so EDS push invalidation (purge-by-cache-tag on the BYO Cloudflare CDN) and the
// /api/revalidate endpoint both target the same key when an author publishes.
export function middleware(request) {
  const res = NextResponse.next();
  const slug = request.nextUrl.pathname.replace(/^\/+|\/+$/g, '') || 'index';
  res.headers.set('Cache-Tag', `page:${slug}`);
  return res;
}

export const config = {
  // Run on page routes only; skip Next internals, the revalidate API, and assets.
  matcher: ['/((?!_next/|api/|.*\\.[^/]+$).*)'],
};
