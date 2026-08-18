import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../actions/convert-email/compile.js';

test('compiles valid MJML to table-based HTML', () => {
  const { html, warnings } = compile('<mjml><mj-body><mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section></mj-body></mjml>');
  assert.match(html, /<table/);
  assert.match(html, /Hi/);
  assert.ok(Array.isArray(warnings));
});

test('surfaces validation issues as warnings without throwing', () => {
  // mj-button placed illegally at body root → soft-validation warning, still returns html.
  const { html, warnings } = compile('<mjml><mj-body><mj-button>x</mj-button></mj-body></mjml>');
  assert.equal(typeof html, 'string');
  assert.ok(warnings.length >= 1);
});
