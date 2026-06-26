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
npx wrangler kv namespace create next-eds-tag-cache  # backs the tag cache (revalidateTag)
npx wrangler secret put REVALIDATE_SECRET            # protects /api/revalidate (see below)
```

## Deploy

```bash
npm run deploy:cf            # production  → renders main--…aem.live
npm run deploy:cf:preview    # preview env → renders main--…aem.page (sidekick previews)
```

The custom domain (`nxtjs.page` + `www`) is wired in `wrangler.jsonc` `routes`.

## CI deploy (GitHub Actions)

`.github/workflows/deploy.yaml` deploys on every push to `main` (and via the **Run workflow**
button). It runs `opennextjs-cloudflare build && deploy` with a Cloudflare API token.

Add two repo secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | A scoped API token (see below) |
| `CLOUDFLARE_ACCOUNT_ID` | The account ID (`wrangler whoami`) |

Create the token from the **"Edit Cloudflare Workers"** template, then add the extras this
project needs:
- **Account** → Workers Scripts: Edit, Workers R2 Storage: Edit, Account Settings: Read
- **Zone** (`nxtjs.page`) → Workers Routes: Edit, Zone: Read, DNS: Edit

The R2 (R2 Storage) and Zone DNS scopes are required for the ISR cache bucket and the custom
domain, respectively — without them the deploy uploads the Worker but the cache binding or
custom-domain step fails.

## Instant updates on publish (publish event → revalidate)

By default a publish appears within ~60s (the `revalidate` window on the `.plain.html` fetch).
For **instant** updates, an EDS publish event invalidates the page's cache:

```
author publishes → EDS fires repository_dispatch (resource-published, with the path)
                 → .github/workflows/revalidate.yaml → POST /api/revalidate
                 → revalidateTag(page:<slug>) clears the tag cache (KV)
                 → next request re-renders from fresh EDS content
```

What's wired in this repo:
- **Tag cache** — `open-next.config.ts` adds `kvNextTagCache` (binding `NEXT_TAG_CACHE_KV` in
  `wrangler.jsonc`); without it `revalidateTag` is a no-op.
- **Endpoint** — `app/api/revalidate/route.js` runs `revalidateTag(page:<slug>)`, guarded by the
  `x-revalidate-secret` header.
- **Workflow** — `.github/workflows/revalidate.yaml` maps the published path → slug and POSTs the
  endpoint.

Setup (account + repo side):
1. `npx wrangler secret put REVALIDATE_SECRET` — set it on the Worker.
2. Add the same value as a **repo secret** `REVALIDATE_SECRET` (used by the workflow).
3. **Enable publish events** from EDS to this repo — see
   <https://www.aem.live/developer/github-actions>. EDS then sends `resource-published` /
   `resource-unpublished` `repository_dispatch` events that the workflow listens for.

> Alternative (not used here): BYO-CDN **push invalidation** purges the *CDN* cache by URL/tag on
> publish — but our lag lives in the Next *data* cache (revalidate), which CDN purge doesn't
> clear, so the publish-event → `revalidateTag` path above is the fit for this Worker.
