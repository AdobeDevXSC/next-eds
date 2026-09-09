import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDocument } from '../actions/convert-email/render/index.js';

const ORIGIN = 'https://eds.example';

function stubFetch(handler) {
  const orig = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(url); return handler(url); };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

test('default content renders without any block-template fetch (still fetches the site theme once)', async () => {
  const tree = [{ kind: 'section', styles: [], children: [{ kind: 'default', html: '<p>Body</p>' }] }];
  const { calls, restore } = stubFetch(() => new Response('', { status: 404 }));
  try {
    const { mjml, warnings } = await renderDocument(tree, { preheader: 'P', origin: ORIGIN });
    assert.match(mjml, /^<mjml>/);
    assert.match(mjml, /<p>Body<\/p>/);
    assert.match(mjml, /P/); // preheader threaded through the shell
    assert.equal(warnings.length, 0);
    assert.deepEqual(calls, [`${ORIGIN}/email-theme.css`]);
  } finally { restore(); }
});

test('a block with a site-hosted template renders via that template', async () => {
  const template = '<mj-section padding="0"><mj-column>{{{rows.0.0}}}</mj-column></mj-section>';
  const tree = [{
    kind: 'section', styles: [],
    children: [{ kind: 'block', name: 'hero', variants: [], html: '', rows: [[{ html: '<h1>Hi</h1>' }]] }],
  }];
  const { calls, restore } = stubFetch((url) => (url === `${ORIGIN}/blocks/hero/hero.email.mjml`
    ? new Response(template, { status: 200 })
    : new Response('', { status: 404 }))); // the site-theme fetch
  try {
    const { mjml, blocksRendered, warnings } = await renderDocument(tree, { origin: ORIGIN });
    assert.match(mjml, /<mj-section padding="0"><mj-column><mj-text><h1>Hi<\/h1><\/mj-text>/);
    assert.deepEqual(blocksRendered, ['hero']);
    assert.equal(warnings.length, 0);
    assert.equal(calls.length, 2);
  } finally { restore(); }
});

test('a block with no site template falls back to generic content-flattening, not omission', async () => {
  const tree = [{
    kind: 'section', styles: [],
    children: [{ kind: 'block', name: 'quote', variants: [], html: '', rows: [[{ html: '<p>Nice quote.</p>' }]] }],
  }];
  const { restore } = stubFetch(() => new Response('', { status: 404 }));
  try {
    const { mjml, blocksRendered, warnings } = await renderDocument(tree, { origin: ORIGIN });
    assert.match(mjml, /<p>Nice quote\.<\/p>/);
    assert.deepEqual(blocksRendered, ['quote']);
    assert.equal(warnings.length, 0);
  } finally { restore(); }
});

test('a non-content block (form/search/modal/embed) is omitted without ever fetching a block template', async () => {
  const tree = [{
    kind: 'section', styles: [],
    children: [{ kind: 'block', name: 'form', variants: [], html: '', rows: [] }],
  }];
  const { calls, restore } = stubFetch((url) => {
    if (url.includes('/blocks/')) throw new Error('should never fetch a block template');
    return new Response('', { status: 404 }); // the site-theme fetch
  });
  try {
    const { blocksRendered, warnings } = await renderDocument(tree, { origin: ORIGIN });
    assert.deepEqual(blocksRendered, []);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /form/);
    assert.deepEqual(calls, [`${ORIGIN}/email-theme.css`]);
  } finally { restore(); }
});

test('the same block name occurring twice fetches its template only once', async () => {
  const template = '<mj-section>{{#each rows.0}}<mj-column>{{{this}}}</mj-column>{{/each}}</mj-section>';
  const tree = [{
    kind: 'section', styles: [],
    children: [
      { kind: 'block', name: 'columns', variants: [], html: '', rows: [[{ html: '<p>A</p>' }]] },
      { kind: 'block', name: 'columns', variants: [], html: '', rows: [[{ html: '<p>B</p>' }]] },
    ],
  }];
  const { calls, restore } = stubFetch(() => new Response(template, { status: 200 }));
  try {
    const { mjml, blocksRendered } = await renderDocument(tree, { origin: ORIGIN });
    assert.match(mjml, /<p>A<\/p>/);
    assert.match(mjml, /<p>B<\/p>/);
    assert.deepEqual(blocksRendered, ['columns', 'columns']);
    assert.equal(calls.length, 2); // one shared block-template fetch + one site-theme fetch
  } finally { restore(); }
});

test('a template fetch failure (5xx) is reported as a warning, not a thrown error', async () => {
  const tree = [{
    kind: 'section', styles: [],
    children: [{ kind: 'block', name: 'hero', variants: [], html: '', rows: [[{ html: '<h1>Hi</h1>' }]] }],
  }];
  const { restore } = stubFetch(() => new Response('', { status: 500 }));
  try {
    const { blocksRendered, warnings } = await renderDocument(tree, { origin: ORIGIN });
    assert.deepEqual(blocksRendered, []);
    // the block-template failure and the site-theme failure (same stub, same 500) each
    // warn independently rather than one masking the other.
    assert.equal(warnings.length, 2);
    assert.ok(warnings.some((w) => /hero/.test(w)));
    assert.ok(warnings.some((w) => /site theme/.test(w)));
  } finally { restore(); }
});

test('a site theme reaches the compiled mjml document', async () => {
  const tree = [{ kind: 'section', styles: [], children: [{ kind: 'default', html: '<p>Body</p>' }] }];
  const { restore } = stubFetch((url) => (url === `${ORIGIN}/email-theme.css`
    ? new Response('.email-card { background: #FCFAF6; }', { status: 200 })
    : new Response('', { status: 404 })));
  try {
    const { mjml, warnings } = await renderDocument(tree, { origin: ORIGIN });
    assert.equal(warnings.length, 0);
    assert.match(mjml, /\.email-card \{ background: #FCFAF6; \}/);
  } finally { restore(); }
});
