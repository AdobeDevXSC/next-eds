import { NextResponse } from 'next/server';

// Tag each rendered page response with a deterministic Cloudflare cache tag derived from
// the URL: `page:<slug>`. This mirrors the Next data-cache tags set in lib/eds/fetch.js,
// so EDS push invalidation (purge-by-cache-tag on the BYO Cloudflare CDN) and the
// /api/revalidate endpoint both target the same key when an author publishes.
//
// Also guards /account: a request with no session cookie is redirected to /signin. This checks
// cookie PRESENCE only (Middleware runs in the Edge runtime, where a KV lookup per request would
// add latency to every navigation) — the guarded routes themselves call getCurrentUser() for full
// validation. /order is intentionally NOT guarded: in the redesign the order is a client-side
// local cart (see lib/order/OrderProvider.jsx) viewable without signing in. See
// docs/superpowers/specs/2026-08-13-stacked-demo-design.md §3.2.
//
// SESSION_COOKIE is duplicated from lib/session.js rather than imported: that module pulls in
// @opennextjs/cloudflare and next/headers, and Middleware's Edge runtime is a known place for
// that kind of import to break the bundle even when nothing in it is actually called. Keep
// this literal in sync with lib/session.js's SESSION_COOKIE export.
const SESSION_COOKIE = 'stacked_session'; // keep in sync with lib/session.js
const GUARDED_PREFIXES = ['/account'];

export function middleware(request) {
  // Canonicalize www → apex (301), preserving path and query.
  if (request.nextUrl.hostname === 'www.nxtjs.page') {
    const url = request.nextUrl.clone();
    url.hostname = 'nxtjs.page';
    return NextResponse.redirect(url, 301);
  }

  const { pathname } = request.nextUrl;
  const isGuarded = GUARDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (isGuarded && !request.cookies.get(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  const slug = request.nextUrl.pathname.replace(/^\/+|\/+$/g, '') || 'index';
  res.headers.set('Cache-Tag', `page:${slug}`);
  return res;
}

export const config = {
  // Run on page routes only; skip Next internals, the revalidate API, and assets.
  matcher: ['/((?!_next/|api/|.*\\.[^/]+$).*)'],
};
