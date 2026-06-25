// Cloudflare Cron Trigger Worker: pokes the Cloudflare Pages Deploy Hook so the static site
// is rebuilt from the latest Edge Delivery content on a schedule. This is the rebuild-on-
// publish mechanism for the static export (which has no runtime server of its own).
//
// Secrets/vars (set via `npx wrangler secret put …`, never commit them):
//   DEPLOY_HOOK_URL  — the Pages Deploy Hook URL (POST triggers a build + deploy)
//   TRIGGER_TOKEN    — optional shared secret to allow manual triggering over HTTP
async function triggerBuild(env) {
  if (!env.DEPLOY_HOOK_URL) return new Response('DEPLOY_HOOK_URL not configured', { status: 500 });
  const res = await fetch(env.DEPLOY_HOOK_URL, { method: 'POST' });
  return new Response(`deploy hook → ${res.status}`, { status: res.ok ? 200 : 502 });
}

export default {
  // Runs on the cron schedule in wrangler.toml.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(triggerBuild(env));
  },

  // Optional manual trigger: POST/GET with ?token=$TRIGGER_TOKEN (e.g. from a publish webhook
  // relay). Returns 200 only when the token matches.
  async fetch(request, env) {
    const token = new URL(request.url).searchParams.get('token');
    if (!env.TRIGGER_TOKEN || token !== env.TRIGGER_TOKEN) {
      return new Response('unauthorized', { status: 401 });
    }
    return triggerBuild(env);
  },
};
