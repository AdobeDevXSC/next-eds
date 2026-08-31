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

test('default content renders without any fetch', async () => {
  const tree = [{ kind: 'section', styles: [], children: [{ kind: 'default', html: '<p>Body</p>' }] }];
  const { calls, restore } = stubFetch(() => new Response('', { status: 404 }));
  try {
    const { mjml, warnings } = await renderDocument(tree, { preheader: 'P', origin: ORIGIN });
    assert.match(mjml, /^<mjml>/);
    assert.match(mjml, /<p>Body<\/p>/);
    assert.match(mjml, /P/); // preheader threaded through the shell
    assert.equal(warnings.length, 0);
    assert.equal(calls.length, 0);
  } finally { restore(); }
});

test('a block with a site-hosted template renders via that template', async () => {
  const template = '<mj-section padding="0"><mj-column>{{{rows.0.0}}}</mj-column></mj-section>';
  const tree = [{
    kind: 'section', styles: [],
    children: [{ kind: 'block', name: 'hero', variants: [], html: '', rows: [[{ html: '<h1>Hi</h1>' }]] }],
  }];
  const { calls, restore } = stubFetch((url) => {
    assert.equal(url, `${ORIGIN}/blocks/hero/hero.email.mjml`);
    return new Response(template, { status: 200 });
  });
  try {
    const { mjml, blocksRendered, warnings } = await renderDocument(tree, { origin: ORIGIN });
    assert.match(mjml, /<mj-section padding="0"><mj-column><mj-text><h1>Hi<\/h1><\/mj-text>/);
    assert.deepEqual(blocksRendered, ['hero']);
    assert.equal(warnings.length, 0);
    assert.equal(calls.length, 1);
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

test('a non-content block (form/search/modal/embed) is omitted without ever fetching a template', async () => {
  const tree = [{
    kind: 'section', styles: [],
    children: [{ kind: 'block', name: 'form', variants: [], html: '', rows: [] }],
  }];
  const { calls, restore } = stubFetch(() => { throw new Error('should never be called'); });
  try {
    const { blocksRendered, warnings } = await renderDocument(tree, { origin: ORIGIN });
    assert.deepEqual(blocksRendered, []);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /form/);
    assert.equal(calls.length, 0);
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
    assert.equal(calls.length, 1);
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
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /hero/);
  } finally { restore(); }
});
