import { unstable_cache } from 'next/cache';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Feature flags: one JSON doc in APP_KV under key `flags` ({ loyalty: true, ... }). Written by
// POST /api/flags (admin-key gated), read here at runtime. Cached under the 'flags' tag so the
// write route's revalidateTag('flags') makes toggles take effect immediately. Unknown/missing
// flags default to false; any KV error degrades to {} (all off) — never throws.

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

const cachedFlags = unstable_cache(readFlags, ['stacked-flags'], { tags: [FLAGS_TAG] });

/** @returns {Promise<Record<string, boolean>>} */
export async function getFlags() {
  return cachedFlags();
}

/** @param {string} name @returns {Promise<boolean>} */
export async function isEnabled(name) {
  return (await getFlags())[name] === true;
}
