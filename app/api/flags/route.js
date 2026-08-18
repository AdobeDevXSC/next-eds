import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { FLAGS_KEY, FLAGS_TAG } from '../../../lib/flags.js';

// Feature-flag admin API. GET is public (the DA app + the site read current state). POST is gated
// by a bearer admin key (FLAGS_ADMIN_KEY secret) and flips one flag in the KV `flags` doc, then
// revalidates the 'flags' cache tag. The DA admin app is served from the AEM origin
// (/tools/feat-flags), a different origin than this Worker, so CORS is allowed for the site's
// aem.live/aem.page hosts (and da.live). POST stays key-gated, so cross-origin access is not a
// security hole — the admin key is the real gate.

// Exact-match allowlist plus the site's aem preview/live hosts (main + branch previews).
const ALLOWED_ORIGINS = new Set([
  'https://da.live',
  'http://localhost:3000',
]);
const ALLOWED_ORIGIN_RE = /^https:\/\/[a-z0-9-]+--next-eds--adobedevxsc\.aem\.(?:live|page)$/i;

function corsHeaders(request) {
  const origin = request.headers.get('origin');
  if (origin && (ALLOWED_ORIGINS.has(origin) || ALLOWED_ORIGIN_RE.test(origin))) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
  }
  return {};
}

function kv() {
  return getCloudflareContext().env.APP_KV;
}

async function readFlags() {
  const raw = await kv().get(FLAGS_KEY);
  if (!raw) return {};
  try { const p = JSON.parse(raw); return p && typeof p === 'object' ? p : {}; } catch { return {}; }
}

export async function OPTIONS(request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request) {
  return NextResponse.json(await readFlags(), { headers: corsHeaders(request) });
}

export async function POST(request) {
  const cors = corsHeaders(request);
  const auth = request.headers.get('authorization') || '';
  const key = getCloudflareContext().env.FLAGS_ADMIN_KEY;
  if (!key || auth !== `Bearer ${key}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  let body;
  try { body = await request.json(); } catch { body = null; }
  const name = body && typeof body.name === 'string' ? body.name : null;
  const enabled = body && typeof body.enabled === 'boolean' ? body.enabled : null;
  if (!name || enabled === null) {
    return NextResponse.json({ error: 'Expected { name: string, enabled: boolean }' }, { status: 400, headers: cors });
  }

  const flags = await readFlags();
  flags[name] = enabled;
  await kv().put(FLAGS_KEY, JSON.stringify(flags));
  revalidateTag(FLAGS_TAG);
  return NextResponse.json(flags, { headers: cors });
}
