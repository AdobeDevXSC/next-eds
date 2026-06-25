# Deploying the Next.js + EDS spike to Cloudflare

The Next.js RSC app **cannot run on `*.aem.live`** — EDS hosting serves cached document
content plus the client-side `/scripts` + `/blocks` code; it does not run a Node/RSC server.
So we invert the relationship: **Cloudflare (your BYO CDN) is the front door and renders Next
at the edge; EDS is the upstream content origin.**

```
        www.yourdomain.com
                │
   ┌────────────▼─────────────┐
   │ Cloudflare (BYO CDN)      │
   │  • caches rendered HTML    │   tagged via `Cache-Tag: page:<slug>` (middleware.js)
   │  • Worker = Next (OpenNext)│   RSC render happens here
   └────────────┬─────────────┘
                │ fetch .plain.html
                ▼
   main--next-eds--AdobeDevXSC.aem.live      (EDS origin: content)
                │
 author publishes (main) ─► EDS push invalidation ─► purges Cloudflare by URL + cache tag
```

## What's wired in this repo

| Concern | File |
| --- | --- |
| Worker build adapter | `open-next.config.ts` (R2-backed incremental/ISR cache) |
| Worker + bindings + per-env origin | `wrangler.jsonc` |
| Edge cache tagging (`Cache-Tag: page:<slug>`) | `middleware.js` |
| On-demand revalidation (Next data cache) | `app/api/revalidate/route.js` |
| Next data-cache tags (`page:<slug>`) | `lib/eds/fetch.js` |
| Local dev bindings | `initOpenNextCloudflareForDev()` in `next.config.mjs` |

Tag scheme is consistent end to end: `page:<slug>` is set as the Next fetch tag, the
Cloudflare `Cache-Tag`, and the revalidate key — so a publish purges the same key everywhere.

## Local commands

```bash
nvm use 22
npm run dev                       # next dev (fetches .page origin by default)
npm run preview:cf                # build Worker + run it locally under workerd

# run the built Worker against the preview origin (content not yet on .live):
npx wrangler dev --var EDS_ORIGIN:https://main--next-eds--AdobeDevXSC.aem.page
```

## One-time Cloudflare setup

```bash
npx wrangler login
npx wrangler r2 bucket create next-eds-spike-cache   # backs the ISR incremental cache
npx wrangler secret put REVALIDATE_SECRET            # optional: protects /api/revalidate
```

## Deploy

```bash
npm run deploy:cf            # production  → renders main--…aem.live
npm run deploy:cf:preview    # preview env → renders main--…aem.page (sidekick previews)
```

Then route your custom domain at this Worker (Workers Routes / custom domain in the
Cloudflare dashboard).

## Wiring EDS push invalidation → Cloudflare

This is the publish→fresh path and is configured on the **EDS** side, not in this repo. Follow
<https://www.aem.live/docs/setup-byo-cdn-push-invalidation-for-cloudflare>:

1. Set the project's production CDN config to your Cloudflare zone with a purge token.
2. EDS then purges your Cloudflare cache **by URL and by cache tag** whenever content/code on
   a `main--…` origin changes. Our `Cache-Tag: page:<slug>` headers make tag purge target the
   right pages. (Tag-based purge is a Cloudflare Enterprise feature; on lower plans, URL purge
   still works.)

> **Notes / follow-ups**
> - Push invalidation fires only for `main` host names, so production must point at
>   `…aem.live` (already the default in `wrangler.jsonc`).
> - For a CDN without native tag purge (e.g. fronting with Vercel instead), use a relay that
>   receives the publish event and calls `POST /api/revalidate` — that path is already built.
> - To make EDS's *native* tag purge maximally precise, propagate EDS origin surrogate keys
>   onto the Worker response in addition to the deterministic `page:<slug>` tag. Deferred.
