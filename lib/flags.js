import { getCloudflareContext } from '@opennextjs/cloudflare';

// Feature flags: one JSON doc in APP_KV under key `flags` ({ loyalty: true, ... }). Written by
// POST /api/flags (admin-key gated), read here at runtime. Read directly from KV per request so
// getCloudflareContext() always runs inside request scope (an unstable_cache callback can run
// outside the request's AsyncLocalStorage on the Workers runtime, where the context read would
// throw and silently return {} — i.e. all flags OFF in prod). KV reads are low-latency and the
// app already does per-request KV reads (sessions, cart). Unknown/missing flags default to false;
// any error degrades to {} (all off) — never throws.

export const FLAGS_KEY = 'flags';
export const FLAGS_TAG = 'flags';

async function readFlags() {
  try {
    const raw = await getCloudflareContext().env.APP_KV.get(FLAGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** @returns {Promise<Record<string, boolean>>} */
export async function getFlags() {
  return readFlags();
}

/** @param {string} name @returns {Promise<boolean>} */
export async function isEnabled(name) {
  return (await getFlags())[name] === true;
}
