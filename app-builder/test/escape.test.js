import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeAttr, escapeText } from '../actions/convert-email/escape.js';

test('escapeAttr encodes & < > " with & taking priority (no double-encoding)', () => {
  assert.equal(escapeAttr('a&b'), 'a&amp;b');
  assert.equal(escapeAttr('<tag>'), '&lt;tag&gt;');
  assert.equal(escapeAttr('say "hi"'), 'say &quot;hi&quot;');
  assert.equal(escapeAttr('a&<b>"c'), 'a&amp;&lt;b&gt;&quot;c');
});

test('escapeText encodes & < > but leaves " untouched', () => {
  assert.equal(escapeText('a&b'), 'a&amp;b');
  assert.equal(escapeText('<tag>'), '&lt;tag&gt;');
  assert.equal(escapeText('say "hi"'), 'say "hi"');
});

test('both handle nullish input as empty string', () => {
  assert.equal(escapeAttr(undefined), '');
  assert.equal(escapeAttr(null), '');
  assert.equal(escapeText(undefined), '');
  assert.equal(escapeText(null), '');
});
