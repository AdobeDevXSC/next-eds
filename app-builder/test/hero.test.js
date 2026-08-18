import test from 'node:test';
import assert from 'node:assert/strict';
import { renderHero } from '../actions/convert-email/render/blocks/hero.js';

test('renders hero image, heading and CTA', () => {
  const block = {
    kind: 'block', name: 'hero', variants: [], html: '',
    rows: [[{ pictureOnly: false, html: '<img src="https://x/h.png" alt="Hero" /><h1>Stacked</h1><p class="button-container"><a href="https://x/menu">Menu</a></p>' }]],
  };
  const out = renderHero(block);
  assert.match(out, /^<mj-section/);
  assert.match(out, /<mj-image src="https:\/\/x\/h\.png"/);
  assert.match(out, /<mj-text><h1>Stacked<\/h1><\/mj-text>/);
  assert.match(out, /<mj-button href="https:\/\/x\/menu">Menu<\/mj-button>/);
});

test('empty hero degrades to an empty section (no throw)', () => {
  const out = renderHero({ kind: 'block', name: 'hero', variants: [], html: '', rows: [] });
  assert.match(out, /<mj-section/);
});
