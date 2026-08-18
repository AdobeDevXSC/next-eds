import { parseEds } from '../../../lib/eds/parse.js';
import { fetchPlainHtml, resolveOrigin } from './fetch.js';
import { normalizeTree } from './normalize.js';
import { renderDocument } from './render/index.js';
import { compile } from './compile.js';

export async function convert({
  path, env = 'preview', origins, preheader = '', subject = '',
} = {}) {
  const html = await fetchPlainHtml(path, { env, origins });
  if (html === null) return null;

  const origin = resolveOrigin(env, origins);
  const tree = normalizeTree(parseEds(html), origin);
  const { mjml, warnings: renderWarnings, blocksRendered } = renderDocument(tree, { preheader });
  const { html: emailHtml, warnings: compileWarnings } = compile(mjml);

  return {
    html: emailHtml,
    subject,
    preheader,
    warnings: [...renderWarnings, ...compileWarnings],
    blocksRendered,
  };
}
