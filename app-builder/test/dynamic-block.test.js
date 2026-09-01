import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchBlockTemplate, buildTemplateData, renderDynamicBlock,
} from '../actions/convert-email/render/dynamic-block.js';

const ORIGIN = 'https://eds.example';

test('fetchBlockTemplate requests blocks/<name>/<name>.email.mjml at the given origin', async () => {
  let requested = '';
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => { requested = url; return new Response('TEMPLATE', { status: 200 }); };
  try {
    const text = await fetchBlockTemplate('hero', ORIGIN);
    assert.equal(requested, 'https://eds.example/blocks/hero/hero.email.mjml');
    assert.equal(text, 'TEMPLATE');
  } finally { globalThis.fetch = orig; }
});

test('fetchBlockTemplate returns null on 404 (no site template — caller should fall back)', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 404 });
  try {
    assert.equal(await fetchBlockTemplate('quote', ORIGIN), null);
  } finally { globalThis.fetch = orig; }
});

test('fetchBlockTemplate throws on a non-404 error status', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 500 });
  try {
    await assert.rejects(() => fetchBlockTemplate('hero', ORIGIN), /500/);
  } finally { globalThis.fetch = orig; }
});

test('buildTemplateData produces rows (per-cell fragments) and rowFragments (per-row joined fragments)', () => {
  const block = {
    name: 'cards', variants: [],
    rows: [
      [{ html: '<img src="https://x/a.png" alt="A" />' }],
      [{ html: '<p>Card 2</p>' }],
    ],
  };
  const data = buildTemplateData(block);
  assert.equal(data.name, 'cards');
  assert.equal(data.rows.length, 2);
  assert.match(data.rows[0][0], /<mj-image src="https:\/\/x\/a\.png"/);
  assert.equal(data.rowFragments.length, 2);
  assert.match(data.rowFragments[1], /<mj-text><p>Card 2<\/p><\/mj-text>/);
});

test('renderDynamicBlock returns null when no site template exists for the block', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 404 });
  try {
    const out = await renderDynamicBlock({ name: 'quote', variants: [], rows: [[{ html: '<p>Hi</p>' }]] }, ORIGIN);
    assert.equal(out, null);
  } finally { globalThis.fetch = orig; }
});

test('renderDynamicBlock renders the fetched template against the block\'s content', async () => {
  const template = '<mj-section padding="0"><mj-column>{{{rows.0.0}}}</mj-column></mj-section>';
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(template, { status: 200 });
  try {
    const out = await renderDynamicBlock({ name: 'hero', variants: [], rows: [[{ html: '<h1>Hi</h1>' }]] }, ORIGIN);
    assert.equal(out, '<mj-section padding="0"><mj-column><mj-text><h1>Hi</h1></mj-text></mj-column></mj-section>');
  } finally { globalThis.fetch = orig; }
});
