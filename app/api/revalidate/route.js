import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

// On-demand revalidation endpoint.
//
// Primary freshness path is EDS push invalidation purging the Cloudflare edge cache by
// `Cache-Tag` (set in middleware.js) the moment an author publishes on `main`. This route
// is the belt-and-suspenders layer: it also clears Next's own data cache for the page, and
// is what you'd call from a relay when fronting with a CDN that lacks native tag purge.
//
// Auth: shared secret in the `x-revalidate-secret` header (set REVALIDATE_SECRET in env).
//
//   curl -X POST https://<host>/api/revalidate \
//     -H "x-revalidate-secret: $REVALIDATE_SECRET" \
//     -H "content-type: application/json" \
//     -d '{"slug":"index"}'
export async function POST(request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (secret && request.headers.get('x-revalidate-secret') !== secret) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let slug = '';
  try {
    ({ slug = '' } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json body' }, { status: 400 });
  }

  const tag = `page:${slug.replace(/^\/+|\/+$/g, '') || 'index'}`;
  revalidateTag(tag);
  // Also refresh the query-index feed (cached under the `pages` tag). Publishing a new or
  // renamed page changes the feed that drives navigation, generateStaticParams, and page
  // metadata — without this they'd lag until the feed's time-based cache expires.
  revalidateTag('pages');

  return NextResponse.json({ ok: true, revalidated: [tag, 'pages'], now: Date.now() });
}
