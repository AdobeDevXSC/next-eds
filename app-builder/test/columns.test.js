import test from 'node:test';
import assert from 'node:assert/strict';
import { renderColumns } from '../actions/convert-email/render/blocks/columns.js';

test('one row of two cells → one section with two columns', () => {
  const block = {
    kind: 'block', name: 'columns', variants: [], html: '',
    rows: [[{ pictureOnly: false, html: '<p>Left</p>' }, { pictureOnly: false, html: '<p>Right</p>' }]],
  };
  const out = renderColumns(block);
  assert.equal((out.match(/<mj-section>/g) || []).length, 1);
  assert.equal((out.match(/<mj-column>/g) || []).length, 2);
  assert.match(out, /Left/);
  assert.match(out, /Right/);
});

test('no rows → empty string', () => {
  assert.equal(renderColumns({ kind: 'block', name: 'columns', variants: [], html: '', rows: [] }), '');
});
