import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';

// OpenNext adapter config for Cloudflare Workers.
// The R2 incremental cache stores ISR/rendered output at the edge; combined with EDS
// push invalidation (which purges by cache tag), a publish on `main` evicts the matching
// pages so the next request re-renders from fresh EDS content.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
