import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { main } from '../actions/convert-email/index.js';
import { send } from '../actions/convert-email/send.js';

const fixture = readFileSync(fileURLToPath(new URL('./fixtures/sample.plain.html', import.meta.url)), 'utf8');

test('missing path → 400', async () => {
  const res = await main({});
  assert.equal(res.statusCode, 400);
});

test('happy path → 200 JSON with html + meta', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(fixture, { status: 200 });
  try {
    const res = await main({ path: '/home', EDS_ORIGIN_PREVIEW: 'https://eds.example' });
    assert.equal(res.statusCode, 200);
    assert.match(res.body.html, /<table/);
    assert.equal(res.body.meta.path, '/home');
    assert.ok(res.body.warnings.some((w) => /form/.test(w)));
  } finally { globalThis.fetch = orig; }
});

test('preview=true → text/html response', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(fixture, { status: 200 });
  try {
    const res = await main({ path: '/home', preview: 'true', EDS_ORIGIN_PREVIEW: 'https://eds.example' });
    assert.equal(res.headers['Content-Type'], 'text/html; charset=utf-8');
    assert.match(res.body, /<table/);
  } finally { globalThis.fetch = orig; }
});

test('404 page → 404', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 404 });
  try {
    const res = await main({ path: '/missing', EDS_ORIGIN_PREVIEW: 'https://eds.example' });
    assert.equal(res.statusCode, 404);
  } finally { globalThis.fetch = orig; }
});

test('send() is not implemented in Phase 1', async () => {
  await assert.rejects(() => send({ to: ['a@x'], subject: 's', html: '<p>x</p>' }), /Phase 2/);
});
