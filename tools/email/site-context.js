// Determines which DA site (org/repo) this tool instance should browse/preview. DA's generic
// app-loading convention (da.live/app/{hostOrg}/{hostRepo}/{toolPath}?org=X&repo=Y) can launch
// this tool for a DIFFERENT site than the one hosting the tool's own code — the query params
// are the authoritative signal for that, so they take priority over the DA App SDK's own
// context (used as a fallback for when the tool is opened without them, e.g. directly inside
// DA) and finally this repo's own org/repo as a last resort for local testing.
//
// The DA auth token, by contrast, can ONLY come from the SDK — there is no query-param
// equivalent — so it's always attempted regardless of where org/repo came from.
const SAFE_NAME = /^[a-z0-9-]+$/;

function fromQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const org = params.get('org');
  const repo = params.get('repo');
  if (org && repo && SAFE_NAME.test(org) && SAFE_NAME.test(repo)) return { org, repo };
  return null;
}

async function fromDaSdk() {
  try {
    const sdk = await Promise.race([
      // eslint-disable-next-line import/no-unresolved -- remote ESM URL, not a local module
      import('https://da.live/nx/utils/sdk.js').then((mod) => mod.default),
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error('not in DA')), 1500);
      }),
    ]);
    const context = (sdk && sdk.context) || {};
    return {
      org: context.org || null,
      repo: context.repo || null,
      token: sdk && sdk.token,
    };
  } catch {
    return { org: null, repo: null, token: null };
  }
}

let cached;

// { org, repo, token }. `token` is null/undefined when not opened inside DA (or the SDK
// didn't resolve in time) — callers that need it (DA API calls) should treat that as "can't
// authenticate," same as today.
export default async function getSiteContext() {
  if (cached) return cached;
  const fromParams = fromQueryParams();
  const sdkResult = await fromDaSdk();
  cached = {
    org: (fromParams && fromParams.org) || sdkResult.org || 'adobedevxsc',
    repo: (fromParams && fromParams.repo) || sdkResult.repo || 'next-eds',
    token: sdkResult.token,
  };
  return cached;
}
