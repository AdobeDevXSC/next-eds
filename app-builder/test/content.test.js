import test from 'node:test';
import assert from 'node:assert/strict';
import { contentToMjml } from '../actions/convert-email/render/blocks/content.js';
import { renderDefault } from '../actions/convert-email/render/blocks/default.js';
import { normalizeHtml } from '../actions/convert-email/normalize.js';

const ORIGIN = 'https://eds.example';

test('plain prose becomes a single mj-text', () => {
  const out = contentToMjml('<h2>Title</h2><p>Body</p>');
  assert.match(out, /<mj-text><h2>Title<\/h2><p>Body<\/p><\/mj-text>/);
  assert.doesNotMatch(out, /mj-button/);
});

test('button-container paragraph becomes mj-button, split from text', () => {
  const out = contentToMjml('<p>Intro</p><p class="button-container"><a href="https://x/go">Go</a></p>');
  assert.match(out, /<mj-text><p>Intro<\/p><\/mj-text>/);
  assert.match(out, /<mj-button href="https:\/\/x\/go">Go<\/mj-button>/);
});

test('img becomes mj-image', () => {
  const out = contentToMjml('<img src="https://x/a.png" alt="A" />');
  assert.match(out, /<mj-image src="https:\/\/x\/a\.png" alt="A"/);
});

test('renderDefault wraps content in a section+column', () => {
  const out = renderDefault({ kind: 'default', html: '<p>Hi</p>' });
  assert.match(out, /^<mj-section><mj-column><mj-text><p>Hi<\/p><\/mj-text><\/mj-column><\/mj-section>$/);
});

// Global Constraint "Entity-encoding": normalizeHtml already entity-encodes the & in
// absolutized href/src values (escapeAttr). contentToMjml re-extracts those values via
// getAttribute() (which decodes on read) and re-applies escapeAttr/escapeText before
// interpolating into its own output strings. Simulate the real pipeline — normalize then
// render — and confirm the result is singly-encoded: a `&amp;`, never a raw `&` and never
// a double-encoded `&amp;amp;`.
test('entity-encoded href/src from normalizeHtml are not double-encoded by contentToMjml', () => {
  const raw = '<p class="button-container"><a href="/go?utm_source=eds&utm_medium=email">Go</a></p>'
    + '<img src="/img.png?w=100&h=200" alt="A">';
  const normalized = normalizeHtml(raw, ORIGIN);

  const out = contentToMjml(normalized);

  assert.match(out, /<mj-button href="https:\/\/eds\.example\/go\?utm_source=eds&amp;utm_medium=email">Go<\/mj-button>/);
  assert.match(out, /<mj-image src="https:\/\/eds\.example\/img\.png\?w=100&amp;h=200" alt="A"/);
  assert.doesNotMatch(out, /&amp;amp;/);
  assert.doesNotMatch(out, /&(?!amp;)/);
});

// A bare text node (no wrapping element) is the one place contentToMjml reads a decoded
// value (node.text) and, unlike every other extraction site in this file, must escape it
// itself before it lands in the mj-text output — there's no <p>/<h2> outerHTML passthrough
// preserving the original encoding for it. Without escapeText here, author text like
// "&lt;script&gt;" round-trips through node-html-parser's decode-on-read and is emitted as
// a live, unescaped <script> tag inside <mj-text>.
test('bare top-level text nodes are entity-escaped before landing in mj-text', () => {
  const out = contentToMjml('Fish &amp; Chips');
  assert.match(out, /<mj-text>Fish &amp; Chips<\/mj-text>/);
  assert.doesNotMatch(out, /&amp;amp;/);

  const scriptOut = contentToMjml('&lt;script&gt;');
  assert.doesNotMatch(scriptOut, /<script>/);
  assert.match(scriptOut, /<mj-text>&lt;script&gt;<\/mj-text>/);
});
