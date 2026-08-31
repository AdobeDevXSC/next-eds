import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { convert } from '../actions/convert-email/pipeline.js';

const fixture = readFileSync(fileURLToPath(new URL('./fixtures/sample.plain.html', import.meta.url)), 'utf8');
const ORIGINS = { preview: 'https://eds.example', live: 'https://eds.example' };

const HERO_TEMPLATE = '<mj-section padding="0"><mj-column>{{{rows.0.0}}}</mj-column></mj-section>';
const CARDS_TEMPLATE = '{{#eachChunk rowFragments 2}}<mj-section>{{#each this}}<mj-column>{{{this}}}</mj-column>{{/each}}</mj-section>{{/eachChunk}}';

// Routes by URL: the page-content fetch gets the fixture; hero/cards get real (simplified)
// site-hosted templates, proving bespoke per-block layout still works end-to-end through the
// new fetch-a-template mechanism; anything else (e.g. a block with no template) 404s, which
// exercises the generic-content-flattening fallback for blocks a site hasn't templated.
function stubPageAndTemplates() {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.endsWith('.plain.html')) return new Response(fixture, { status: 200 });
    if (url.endsWith('/blocks/hero/hero.email.mjml')) return new Response(HERO_TEMPLATE, { status: 200 });
    if (url.endsWith('/blocks/cards/cards.email.mjml')) return new Response(CARDS_TEMPLATE, { status: 200 });
    return new Response('', { status: 404 });
  };
  return () => { globalThis.fetch = orig; };
}

test('converts a fixture page end-to-end to email HTML', async () => {
  const restore = stubPageAndTemplates();
  try {
    const result = await convert({ path: '/home', env: 'preview', origins: ORIGINS, preheader: 'Lunch time' });
    assert.match(result.html, /<table/);              // compiled to tables
    assert.match(result.html, /Stacked/);             // hero heading
    assert.match(result.html, /Fresh every day/);     // default content
    assert.match(result.html, /Caprese/);             // cards
    assert.match(result.html, /eds\.example\/media_hero\.png/); // absolutized image
    assert.doesNotMatch(result.html, /Newsletter signup/);      // form omitted
    assert.ok(result.warnings.some((w) => /form/.test(w)));
    assert.deepEqual(result.blocksRendered.sort(), ['cards', 'hero']);
    assert.equal(result.preheader, 'Lunch time');
  } finally { restore(); }
});

test('returns null for a 404 page', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 404 });
  try {
    assert.equal(await convert({ path: '/missing', env: 'preview', origins: ORIGINS }), null);
  } finally { globalThis.fetch = orig; }
});
