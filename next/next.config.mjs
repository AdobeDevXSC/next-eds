import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// Makes Cloudflare bindings (R2 incremental cache, vars) available during `next dev`.
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root (this dir nests inside the EDS repo, which has its own lockfile).
  turbopack: { root: import.meta.dirname },
  // EDS optimizes images on its own delivery origin; the spike renders the EDS <picture>
  // markup as-is, so no remote image config is required.
};

export default nextConfig;
