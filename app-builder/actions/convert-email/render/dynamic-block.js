import { contentToMjml } from './blocks/content.js';
import { renderTemplate } from './template.js';

// Fetches a site-hosted email layout for a block, e.g. blocks/hero/hero.email.mjml — the
// same fetch pattern the action already uses for .plain.html, so it works against any EDS
// site with no action change: a site adds/edits a template file next to its block, and the
// action picks it up on the next request. Returns null when the site has no template for
// this block (a plain 404 from static EDS delivery), signaling the caller to fall back to
// generic content-flattening rather than omitting the block outright.
export async function fetchBlockTemplate(name, origin) {
  const res = await fetch(`${origin}/blocks/${name}/${name}.email.mjml`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`template fetch failed: HTTP ${res.status} for blocks/${name}/${name}.email.mjml`);
  return res.text();
}

// The data model exposed to a block's template. `rows` mirrors the block's own cell grid
// (each cell independently run through contentToMjml) — for layouts where each cell in a
// row is its own column (e.g. columns: {{#each rows.0}}). `rowFragments` pre-joins each
// row's cells into one fragment — for layouts where a whole row is one unit (e.g. cards:
// {{#eachChunk rowFragments 2}}, grouping cards N-per-section). Both are derived from the
// same contentToMjml calls; exposing both access shapes covers every layout without the
// template language needing real logic to reshape one into the other.
export function buildTemplateData(block) {
  const rows = (block.rows || []).map((cells) => cells.map((cell) => contentToMjml(cell.html)));
  const rowFragments = (block.rows || [])
    .map((cells) => contentToMjml(cells.map((cell) => cell.html).join('')));
  return { name: block.name, variants: block.variants, rows, rowFragments };
}

export async function renderDynamicBlock(block, origin) {
  const template = await fetchBlockTemplate(block.name, origin);
  if (template === null) return null;
  return renderTemplate(template, buildTemplateData(block));
}
