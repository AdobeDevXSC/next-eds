import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

// On-demand revalidation endpoint. Clears Next's data cache for a page by its `page:<slug>`
// tag so the next request re-renders from fresh content.
//
// Intentionally unauthenticated so the AEM Sidekick can call it from the browser on Preview
// (a client-side caller can't hold a secret). This only forces a cache refresh — no data is
// exposed — so the worst case is extra origin fetches. CORS is open for the same reason.
//
//   POST /api/revalidate?slug=getting-started      (query param — used by the Sidekick hook)
//   POST /api/revalidate  { "slug": "getting-started" }   (JSON body — used by the workflow)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request) {
  // Prefer the slug from the query string (simple cross-origin POST, no preflight); fall back
  // to a JSON body for server callers.
  let slug = new URL(request.url).searchParams.get('slug') ?? '';
  if (!slug) {
    try {
      ({ slug = '' } = await request.json());
    } catch {
      // no/invalid body — treat as the index
    }
  }

  const tag = `page:${slug.replace(/^\/+|\/+$/g, '') || 'index'}`;
  revalidateTag(tag);

  return NextResponse.json({ ok: true, revalidated: tag, now: Date.now() }, { headers: CORS });
}
