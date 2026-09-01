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

test('org+repo params target that site instead of the manifest default, even when EDS_ORIGIN_PREVIEW is also set', async () => {
  const requests = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => { requests.push(url); return new Response(fixture, { status: 200 }); };
  try {
    const res = await main({
      path: '/home', org: 'srm0233-adobe', repo: 'osg', EDS_ORIGIN_PREVIEW: 'https://eds.example',
    });
    assert.equal(res.statusCode, 200);
    assert.equal(requests[0], 'https://main--osg--srm0233-adobe.aem.page/home.plain.html');
    assert.ok(requests.every((u) => u.startsWith('https://main--osg--srm0233-adobe.aem.page/')));
  } finally { globalThis.fetch = orig; }
});

test('invalid org/repo format → 400, never silently falls back to the default site', async () => {
  const res = await main({ path: '/home', org: 'not valid!', repo: 'osg' });
  assert.equal(res.statusCode, 400);
});

test('org without repo (or vice versa) is a 400, not a silent fallback to the default site', async () => {
  const res = await main({ path: '/home', org: 'srm0233-adobe' });
  assert.equal(res.statusCode, 400);
});

test('neither org nor repo provided → normal manifest-default behavior, unaffected', async () => {
  const requests = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => { requests.push(url); return new Response(fixture, { status: 200 }); };
  try {
    const res = await main({ path: '/home', EDS_ORIGIN_PREVIEW: 'https://eds.example' });
    assert.equal(res.statusCode, 200);
    assert.equal(requests[0], 'https://eds.example/home.plain.html');
  } finally { globalThis.fetch = orig; }
});
