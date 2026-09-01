import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrigin, fetchPlainHtml, buildOriginsFromOrgRepo } from '../actions/convert-email/fetch.js';

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

test('empty path maps to index.plain.html', async () => {
  let called = '';
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => { called = url; return new Response('<i></i>', { status: 200 }); };
  try {
    await fetchPlainHtml('', { env: 'preview', origins: ORIGINS });
    assert.equal(called, 'https://p.example/index.plain.html');
  } finally { globalThis.fetch = orig; }
});

test('non-ok status rejects with error', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 500 });
  try {
    await assert.rejects(
      () => fetchPlainHtml('/x', { env: 'preview', origins: ORIGINS }),
      /EDS fetch failed: 500/,
    );
  } finally { globalThis.fetch = orig; }
});

test('buildOriginsFromOrgRepo builds preview/live origins for a valid org+repo', () => {
  assert.deepEqual(buildOriginsFromOrgRepo('srm0233-adobe', 'osg'), {
    preview: 'https://main--osg--srm0233-adobe.aem.page',
    live: 'https://main--osg--srm0233-adobe.aem.live',
  });
});

test('buildOriginsFromOrgRepo accepts mixed-case org/repo — GitHub org names are case-sensitive', () => {
  // AdobeDevXSC is this deployment's own real org (main--next-eds--AdobeDevXSC.aem.page) —
  // verified against the real deployed action that a lowercase-only version of this
  // validator incorrectly rejected its own org name.
  assert.deepEqual(buildOriginsFromOrgRepo('AdobeDevXSC', 'next-eds'), {
    preview: 'https://main--next-eds--AdobeDevXSC.aem.page',
    live: 'https://main--next-eds--AdobeDevXSC.aem.live',
  });
});

test('buildOriginsFromOrgRepo rejects org/repo with characters outside [a-zA-Z0-9-]', () => {
  assert.equal(buildOriginsFromOrgRepo('srm0233-adobe', 'osg/../x'), null); // path traversal attempt
  assert.equal(buildOriginsFromOrgRepo('srm0233-adobe', 'o sg'), null); // space
  assert.equal(buildOriginsFromOrgRepo('srm0233-adobe.com', 'osg'), null); // dot
  assert.equal(buildOriginsFromOrgRepo('', 'osg'), null); // empty
  assert.equal(buildOriginsFromOrgRepo('srm0233-adobe', ''), null); // empty
});
