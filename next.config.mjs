/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: prerender every page to plain HTML at build time (no runtime server).
  // The <head> is baked in via generateMetadata; deploy the `out/` folder to any static host.
  output: 'export',
  trailingSlash: true,
  // EDS already delivers optimized <picture> markup; we render it as-is, so disable the
  // Next image optimizer (which needs a server it won't have in a static export).
  images: { unoptimized: true },
};

export default nextConfig;
