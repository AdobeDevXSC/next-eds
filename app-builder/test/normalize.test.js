import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'node-html-parser';
import { normalizeHtml, normalizeTree } from '../actions/convert-email/normalize.js';

const ORIGIN = 'https://eds.example';

test('collapses <picture> to a single absolute <img>', () => {
  const out = normalizeHtml(
    '<picture><source srcset="./media_a.webp?width=750"><img src="./media_a.png?width=750" alt="Hi"></picture>',
    ORIGIN,
  );
  assert.match(out, /<img[^>]+src="https:\/\/eds\.example\/media_a\.png\?width=750"/);
  assert.match(out, /alt="Hi"/);
  assert.doesNotMatch(out, /<picture|<source/);
});

test('absolutizes root-relative and bare links, strips scripts', () => {
  const out = normalizeHtml('<a href="/menu">m</a><a href="x/y">y</a><script>bad()</script>', ORIGIN);
  assert.match(out, /href="https:\/\/eds\.example\/menu"/);
  assert.match(out, /href="https:\/\/eds\.example\/x\/y"/);
  assert.doesNotMatch(out, /script/);
});

test('leaves absolute, anchor, and mailto links untouched', () => {
  const out = normalizeHtml('<a href="https://x.com">a</a><a href="#top">b</a><a href="mailto:h@x">c</a>', ORIGIN);
  assert.match(out, /href="https:\/\/x\.com"/);
  assert.match(out, /href="#top"/);
  assert.match(out, /href="mailto:h@x"/);
});

test('absolutized URLs with multiple query params entity-encode & with no double-encoding', () => {
  const out = normalizeHtml('<a href="/promo?utm_source=eds&utm_medium=email">go</a>', ORIGIN);
  assert.match(out, /href="https:\/\/eds\.example\/promo\?utm_source=eds&amp;utm_medium=email"/);
  assert.doesNotMatch(out, /&amp;amp;/);
});

test('picture src with multiple query params entity-encodes & with no double-encoding', () => {
  const out = normalizeHtml(
    '<picture><source srcset="./media_a.webp?width=750"><img src="./media_a.png?width=750&format=webp" alt="Hi"></picture>',
    ORIGIN,
  );
  assert.match(out, /src="https:\/\/eds\.example\/media_a\.png\?width=750&amp;format=webp"/);
  assert.doesNotMatch(out, /&amp;amp;/);
});

test('alt text containing a literal ampersand-entity-like sequence survives normalizeHtml intact (not decoded)', () => {
  const out = normalizeHtml(
    '<picture><img src="./a.png" alt="Fish &amp; Chips &amp;copy 2024"></picture>',
    ORIGIN,
  );
  // Re-parse the output the way a downstream consumer would, and confirm the author's
  // literal text round-trips exactly — it must NOT have been silently decoded to "©".
  const reparsed = parse(out).querySelector('img').getAttribute('alt');
  assert.equal(reparsed, 'Fish & Chips &copy 2024');
  assert.doesNotMatch(reparsed, /©/);
});

test('href containing a literal ampersand-entity-like sequence survives normalizeHtml intact (not decoded)', () => {
  const out = normalizeHtml('<a href="/x?note=Fish &amp; Chips &amp;copy 2024">go</a>', ORIGIN);
  const reparsed = parse(out).querySelector('a').getAttribute('href');
  assert.equal(reparsed, 'https://eds.example/x?note=Fish & Chips &copy 2024');
  assert.doesNotMatch(reparsed, /©/);
});

test('strips onclick attribute from anchor while preserving element and href', () => {
  const out = normalizeHtml('<a onclick="x()" href="/a">t</a>', ORIGIN);
  assert.doesNotMatch(out, /onclick/i);
  assert.match(out, /<a[^>]+href="https:\/\/eds\.example\/a"/);
  assert.match(out, />t<\/a>/);
});

test('strips onerror attribute from img while preserving element and src', () => {
  const out = normalizeHtml('<img onerror="x()" src="/a.png">', ORIGIN);
  assert.doesNotMatch(out, /onerror/i);
  assert.match(out, /<img[^>]+src="https:\/\/eds\.example\/a\.png"/);
});

test('strips assorted on* handlers case-insensitively across multiple elements', () => {
  const out = normalizeHtml(
    '<div OnMouseOver="x()"><a onclick="y()" href="/a">a</a><img ONLOAD="z()" src="/b.png"></div>',
    ORIGIN,
  );
  assert.doesNotMatch(out, /onmouseover/i);
  assert.doesNotMatch(out, /onclick/i);
  assert.doesNotMatch(out, /onload/i);
  // Elements and their safe attributes remain.
  assert.match(out, /<a[^>]+href="https:\/\/eds\.example\/a"/);
  assert.match(out, /<img[^>]+src="https:\/\/eds\.example\/b\.png"/);
});

test('javascript: URLs are defanged by absolutize (documents existing behavior)', () => {
  const out = normalizeHtml('<a href="javascript:alert(1)">go</a>', ORIGIN);
  assert.doesNotMatch(out, /href="javascript:/i);
  assert.match(out, /href="https:\/\/eds\.example\/javascript:alert\(1\)"/);
});

test('normalizeTree rewrites default nodes and block cells', () => {
  const tree = [{
    kind: 'section',
    styles: [],
    children: [
      { kind: 'default', html: '<a href="/a">a</a>' },
      { kind: 'block', name: 'hero', variants: [], html: '', rows: [[{ html: '<a href="/b">b</a>', pictureOnly: false }]] },
    ],
  }];
  normalizeTree(tree, ORIGIN);
  assert.match(tree[0].children[0].html, /href="https:\/\/eds\.example\/a"/);
  assert.match(tree[0].children[1].rows[0][0].html, /href="https:\/\/eds\.example\/b"/);
});
