import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// Makes Cloudflare bindings (R2 incremental cache, vars) available during `next dev`.
initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The Next app is rooted at the repo root, so the colocated React blocks in /blocks are
  // naturally in compilation scope — no root overrides needed.
  // EDS optimizes images on its own delivery origin; the spike renders the EDS <picture>
  // markup as-is, so no remote image config is required.
};

export default nextConfig;
