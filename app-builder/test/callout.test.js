import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCallout } from '../actions/convert-email/render/blocks/callout.js';

test('renders a tinted section with content', () => {
  const block = {
    kind: 'block', name: 'callout', variants: [], html: '',
    rows: [[{ pictureOnly: false, html: '<h3>Sale</h3><p class="button-container"><a href="https://x/shop">Shop</a></p>' }]],
  };
  const out = renderCallout(block);
  assert.match(out, /<mj-section[^>]+background-color=/);
  assert.match(out, /<mj-text><h3>Sale<\/h3><\/mj-text>/);
  assert.match(out, /<mj-button href="https:\/\/x\/shop">Shop<\/mj-button>/);
});
