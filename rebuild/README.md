# Rebuild-on-publish (Cloudflare)

The static export has no runtime server, so published content goes live by **rebuilding**. This
is all Cloudflare-native: **Cloudflare Pages** builds and hosts the site, and a small **Cron
Trigger Worker** (here) pokes the Pages **Deploy Hook** on a schedule.

```
EDS publish ──(content lives in DA)         Cloudflare Pages
                                              • build: npm run build
Cron Worker (every 15 min) ──POST──▶ Deploy Hook ─▶ • output dir: out
                                              • deploy out/  →  your domain
git push (code changes) ─────────────────────▶ Pages Git integration (auto-build)
```

## 1. Cloudflare Pages (host + build)

Create a Pages project from this repo (dashboard → Workers & Pages → Pages → connect to Git), with:

- **Build command:** `npm run build`
- **Build output directory:** `out`
- **Environment variables:** `NODE_VERSION=22`, optionally `EDS_ORIGIN` and `SITE_URL`
  (set `SITE_URL` to the Pages domain so canonical URLs point here).

Git integration rebuilds automatically on **code** pushes. Content changes need the trigger below.

## 2. Deploy Hook

In the Pages project → Settings → Builds & deployments → **Deploy hooks** → create one.
Copy the URL (a `POST` to it triggers a build + deploy).

## 3. This Cron Worker (content refresh)

```bash
cd rebuild
npx -y wrangler@4 secret put DEPLOY_HOOK_URL   # paste the Deploy Hook URL
npx -y wrangler@4 secret put TRIGGER_TOKEN      # optional: enables manual ?token= triggering
npx -y wrangler@4 deploy
```

The cron in `wrangler.toml` (`*/15 * * * *`) rebuilds every 15 minutes — that's the freshness
window for published content. Adjust as needed.

## Want true on-publish (not interval)?

EDS doesn't emit a generic publish webhook (its push invalidation targets a CDN purge API), so
event-driven triggering needs a relay that calls this Worker's `fetch` endpoint with
`?token=$TRIGGER_TOKEN`, or calls the Deploy Hook directly. Until that's wired, the cron interval
is the pragmatic Cloudflare-native trigger.
