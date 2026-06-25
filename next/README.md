# next-eds spike

Proof-of-concept for [issue #1](https://github.com/AdobeDevXSC/next-eds/issues/1): render AEM Edge
Delivery content through **Next.js App Router + React Server Components**, keeping EDS as the
headless content/authoring source. Validates the parse → registry → RSC pipeline with the Hero block.

## Run

Requires Node 18+ (this repo's default Node may be older — use nvm):

```bash
nvm use 22   # or any Node >= 18
cd next
npm install
npm run dev  # http://localhost:3000  (or: npm run build && npm start)
```

By default it fetches from `https://main--next-eds--AdobeDevXSC.aem.page`. Override with:

```bash
EDS_ORIGIN=https://<branch>--next-eds--AdobeDevXSC.aem.page npm run dev
```

## How it maps to the architecture

| EDS / `aem.js` concept            | Spike equivalent                                  |
| --------------------------------- | ------------------------------------------------- |
| Delivered `.plain.html`           | `lib/eds/fetch.js` (+ absolutizes asset URLs)     |
| `decorateSections` / block parse  | `lib/eds/parse.js` → normalized node tree         |
| `loadBlocks` / block `decorate()` | `lib/eds/render.js` + `blocks/registry.js`        |
| A block (`class="hero"`)          | `blocks/hero/Hero.js` (React Server Component)    |

`aem.js`'s **parse/normalize** half becomes pure functions; its **load/decorate** half is replaced by
React component resolution. Static blocks render as Server Components — **zero block-level client JS**.

## Deployment

EDS can't host the RSC server, so Cloudflare (BYO CDN) fronts EDS and renders Next at the edge
via OpenNext, with EDS push invalidation purging the cache on publish. See [DEPLOYMENT.md](./DEPLOYMENT.md).

```bash
npm run preview:cf   # build + run the Worker locally
npm run deploy:cf    # deploy to Cloudflare
```

## Status / next steps

Mapped: `hero`. Unmapped blocks (`columns`, `cards`) render a visible placeholder.
See issue #1 for the out-of-scope follow-ups (nav/footer fragments, metadata/SEO, interactive
`'use client'` island blocks, sidekick preview wiring).
