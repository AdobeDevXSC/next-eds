import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
import kvNextTagCache from '@opennextjs/cloudflare/overrides/tag-cache/kv-next-tag-cache';

// OpenNext adapter config for Cloudflare Workers.
// - incrementalCache (R2): stores the cached .plain.html fetches / rendered output.
// - tagCache (KV): maps cache tags → keys so revalidateTag() works. The /api/revalidate
//   endpoint uses it to clear a page's cache the instant an author publishes (driven by the
//   EDS publish event → GitHub Action → /api/revalidate).
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  tagCache: kvNextTagCache,
});
