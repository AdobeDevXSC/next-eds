import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDocument } from '../actions/convert-email/render/index.js';

const tree = [{
  kind: 'section',
  styles: [],
  children: [
    { kind: 'block', name: 'hero', variants: [], html: '', rows: [[{ pictureOnly: false, html: '<h1>Hi</h1>' }]] },
    { kind: 'default', html: '<p>Body</p>' },
    { kind: 'block', name: 'form', variants: [], html: '', rows: [] },
  ],
}];

test('renders known blocks + default, warns on unknown, lists rendered blocks', () => {
  const { mjml, warnings, blocksRendered } = renderDocument(tree, { preheader: 'P' });
  assert.match(mjml, /^<mjml>/);
  assert.match(mjml, /<h1>Hi<\/h1>/);
  assert.match(mjml, /<p>Body<\/p>/);
  assert.match(mjml, /P/); // preheader threaded through the shell
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /form/);
  assert.deepEqual(blocksRendered, ['hero']);
});
