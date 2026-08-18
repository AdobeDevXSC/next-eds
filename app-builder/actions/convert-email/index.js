import { convert } from './pipeline.js';
import { DEFAULT_ORIGINS } from './fetch.js';

function isTrue(v) {
  return v === true || v === 'true' || v === '1';
}

export async function main(params = {}) {
  const path = params.path || params.__ow_path || '';
  if (!path) {
    return { statusCode: 400, body: { error: 'missing required param: path' } };
  }

  const env = params.env === 'live' ? 'live' : 'preview';
  const origins = {
    preview: params.EDS_ORIGIN_PREVIEW || DEFAULT_ORIGINS.preview,
    live: params.EDS_ORIGIN_LIVE || DEFAULT_ORIGINS.live,
  };

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
