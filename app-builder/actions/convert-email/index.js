import { convert } from './pipeline.js';
import { DEFAULT_ORIGINS, buildOriginsFromOrgRepo } from './fetch.js';

function isTrue(v) {
  return v === true || v === 'true' || v === '1';
}

export async function main(params = {}) {
  const path = params.path || params.__ow_path || '';
  if (!path) {
    return { statusCode: 400, body: { error: 'missing required param: path' } };
  }

  const env = params.env === 'live' ? 'live' : 'preview';

  // org/repo let a caller point this action at any EDS site (e.g. tools/email forwarding
  // whatever site DA told it to browse) rather than only the site baked into this
  // deployment's manifest defaults — deliberately open, no allowlist: this action has no
  // auth today, and content served from *.aem.page/*.aem.live is already public regardless
  // of which origin fetches it. Providing only one of the two, or an invalid one, is a 400 —
  // never a silent fallback to the default site, which would serve the wrong content with
  // no indication anything was off.
  let origins;
  if (params.org || params.repo) {
    origins = buildOriginsFromOrgRepo(params.org, params.repo);
    if (!origins) {
      return { statusCode: 400, body: { error: 'org and repo must both be provided and contain only [a-z0-9-]' } };
    }
  } else {
    origins = {
      preview: params.EDS_ORIGIN_PREVIEW || DEFAULT_ORIGINS.preview,
      live: params.EDS_ORIGIN_LIVE || DEFAULT_ORIGINS.live,
    };
  }

  try {
    const result = await convert({
      path,
      env,
      origins,
      subject: params.subject || '',
      preheader: params.preheader || '',
    });

    if (result === null) {
      return { statusCode: 404, body: { error: 'page not found', path } };
    }

    if (isTrue(params.preview)) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: result.html,
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        html: result.html,
        subject: result.subject,
        preheader: result.preheader,
        warnings: result.warnings,
        meta: { path, env, blocksRendered: result.blocksRendered },
      },
    };
  } catch (err) {
    return { statusCode: 502, body: { error: 'conversion failed', message: err.message } };
  }
}
