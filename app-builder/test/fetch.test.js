import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrigin, fetchPlainHtml } from '../actions/convert-email/fetch.js';

const ORIGINS = { preview: 'https://p.example', live: 'https://l.example' };

test('resolveOrigin picks live vs preview', () => {
  assert.equal(resolveOrigin('live', ORIGINS), 'https://l.example');
  assert.equal(resolveOrigin('preview', ORIGINS), 'https://p.example');
  assert.equal(resolveOrigin(undefined, ORIGINS), 'https://p.example');
});

test('fetchPlainHtml builds the .plain.html URL and returns body', async () => {
  let called = '';
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => { called = url; return new Response('<div></div>', { status: 200 }); };
  try {
    const html = await fetchPlainHtml('/menu/cubano', { env: 'live', origins: ORIGINS });
    assert.equal(called, 'https://l.example/menu/cubano.plain.html');
    assert.equal(html, '<div></div>');
  } finally { globalThis.fetch = orig; }
});

test('fetchPlainHtml maps empty path to index and 404 to null', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 404 });
  try {
    assert.equal(await fetchPlainHtml('', { env: 'preview', origins: ORIGINS }), null);
  } finally { globalThis.fetch = orig; }
});
