import test from 'node:test';
import assert from 'node:assert/strict';
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
