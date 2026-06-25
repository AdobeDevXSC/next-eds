# Deploying the Next.js + EDS static export

The Next.js app **prerenders to static HTML at build time** (`output: 'export'`) — no runtime
server. Edge Delivery stays the content + authoring source; the build reads it and emits a
plain `out/` folder you host anywhere.

```
Authors (Docs/DA) → EDS → *.aem.page / *.aem.live
                              │ .plain.html + page <head> metadata
                              ▼
                   next build  (output: 'export')
                     • generateStaticParams → which pages to prerender
                     • fetch .plain.html → parse → render blocks (RSC, 0 client JS)
                     • generateMetadata → bake <head> (title, description, canonical, OG)
                              │
                              ▼
                          out/  → static host (Cloudflare Pages, S3, GitHub Pages, …)
```

## Build & preview

```bash
nvm use 22
npm install
npm run build     # → out/  (static HTML, head baked in)
npm run serve     # serve out/ locally to check
```

Point the build at a different content origin (defaults to the `main` preview):

```bash
EDS_ORIGIN=https://main--next-eds--adobedevxsc.aem.page npm run build
```

Set `SITE_URL` to your public host so the prerendered pages get a **canonical URL** pointing at
this surface (resolves the duplicate-content risk with the EDS origin):

```bash
SITE_URL=https://www.yourdomain.com npm run build
```

## Hosting

Deploy `out/` to any static host (Cloudflare Pages, S3 + CloudFront, Netlify, GitHub Pages).
No server, no Worker, no Node runtime.

## Keeping content fresh — rebuild on publish (Cloudflare-native)

Because the HTML is generated at build time, content changes go live by **rebuilding**, not by a
cache purge. The wired setup is all Cloudflare:

- **Cloudflare Pages** builds (`npm run build`) and hosts `out/`; its Git integration auto-builds
  on code pushes.
- A **Cron Trigger Worker** in [`rebuild/`](rebuild/README.md) pokes the Pages **Deploy Hook** on
  a schedule (default every 15 min) to pick up newly published content.

See [`rebuild/README.md`](rebuild/README.md) for the exact steps. A GitHub Actions
`repository_dispatch` calling the same Deploy Hook is an equivalent non-Cloudflare alternative.

Trade-off vs. a runtime server: a publish takes a build cycle to appear (the cron interval)
instead of being instant, in exchange for zero server cost and a purely static surface.

## What pages get built

`generateStaticParams()` (in `app/[[...slug]]/page.js`) lists the pages to prerender. This site
has no `query-index.json`, so it currently enumerates the index only — a production build would
read a sitemap / query-index and map its `.data[].path` entries.

## SEO / GEO notes

`generateMetadata()` bakes `<title>`, description, Open Graph, and (with `SITE_URL`) a canonical
`<link>` into each page's `<head>` — what makes the static surface indexable, shareable, and
citable.

### Canonical & indexing (resolve the duplicate-surface risk)

The same content is reachable on **two** surfaces: the Cloudflare Pages site (the public front
door) and the EDS origin (`…aem.live`). Pick the Pages site as the single canonical, indexable
surface:

1. **Make the Pages site canonical.** Set `SITE_URL` to the public Pages/custom domain in the
   Pages build env. Then `generateMetadata()` emits `<link rel="canonical" href="https://your-
   domain/…">` on every page, pointing search and AI engines at this surface.
2. **Keep the Pages pages indexable.** The build emits no `robots` `noindex` for content pages,
   so they're crawlable by default — leave it that way. (The `nav`/`footer` fragments keep their
   own `noindex` and are not standalone pages, which is correct.)
3. **De-index the EDS origin.** So `…aem.live` doesn't compete as duplicate content, disallow it
   in the EDS-served `robots.txt` (it's per-host) and/or only ever publicize/link the Pages
   domain. The `…aem.page` preview host is already non-public.

### Cloudflare Pages build environment

| Variable | Purpose |
| --- | --- |
| `NODE_VERSION=22` | Build needs Node 18+ |
| `EDS_ORIGIN` | Content origin to read at build (defaults to the `main` preview) |
| `SITE_URL` | Public host — drives the canonical `<link>`; set to the Pages/custom domain |
