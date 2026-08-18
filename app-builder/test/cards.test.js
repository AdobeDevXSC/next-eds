import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCards } from '../actions/convert-email/render/blocks/cards.js';

function card(n) {
  return [{ pictureOnly: false, html: `<img src="https://x/${n}.png" alt="${n}" /><p>Card ${n}</p>` }];
}

test('renders three cards as two sections (2 + 1 columns)', () => {
  const out = renderCards({ kind: 'block', name: 'cards', variants: [], html: '', rows: [card(1), card(2), card(3)] });
  const sections = out.match(/<mj-section>/g) || [];
  const columns = out.match(/<mj-column>/g) || [];
  assert.equal(sections.length, 2);
  assert.equal(columns.length, 3);
  assert.match(out, /Card 1/);
  assert.match(out, /Card 3/);
});

test('no rows → empty string (no throw)', () => {
  assert.equal(renderCards({ kind: 'block', name: 'cards', variants: [], html: '', rows: [] }), '');
});
