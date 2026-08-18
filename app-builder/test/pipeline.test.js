import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { convert } from '../actions/convert-email/pipeline.js';

const fixture = readFileSync(fileURLToPath(new URL('./fixtures/sample.plain.html', import.meta.url)), 'utf8');
const ORIGINS = { preview: 'https://eds.example', live: 'https://eds.example' };

test('converts a fixture page end-to-end to email HTML', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(fixture, { status: 200 });
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
  } finally { globalThis.fetch = orig; }
});

test('returns null for a 404 page', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 404 });
  try {
    assert.equal(await convert({ path: '/missing', env: 'preview', origins: ORIGINS }), null);
  } finally { globalThis.fetch = orig; }
});
