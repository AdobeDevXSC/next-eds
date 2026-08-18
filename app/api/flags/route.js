import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { FLAGS_KEY, FLAGS_TAG } from '../../../lib/flags.js';

// Feature-flag admin API. GET is public (the DA app + app read current state). POST is gated by
// a bearer admin key (FLAGS_ADMIN_KEY secret) and flips one flag in the KV `flags` doc, then
// revalidates the 'flags' cache tag so getFlags() reflects it immediately.

function kv() {
  return getCloudflareContext().env.APP_KV;
}

async function readFlags() {
  const raw = await kv().get(FLAGS_KEY);
  if (!raw) return {};
  try { const p = JSON.parse(raw); return p && typeof p === 'object' ? p : {}; } catch { return {}; }
}

export async function GET() {
  return NextResponse.json(await readFlags());
}

export async function POST(request) {
  const auth = request.headers.get('authorization') || '';
  const key = getCloudflareContext().env.FLAGS_ADMIN_KEY;
  if (!key || auth !== `Bearer ${key}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch { body = null; }
  const name = body && typeof body.name === 'string' ? body.name : null;
  const enabled = body ? body.enabled === true : null;
  if (!name || enabled === null) {
    return NextResponse.json({ error: 'Expected { name: string, enabled: boolean }' }, { status: 400 });
  }

  const flags = await readFlags();
  flags[name] = enabled;
  await kv().put(FLAGS_KEY, JSON.stringify(flags));
  revalidateTag(FLAGS_TAG);
  return NextResponse.json(flags);
}
