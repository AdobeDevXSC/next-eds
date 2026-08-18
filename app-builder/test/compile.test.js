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

test('warnings do not leak the runtime cwd filesystem path', () => {
  // mjml's formattedMessage embeds the process's absolute cwd (e.g.
  // "Line 1 of /Users/.../app-builder (mj-button) — ..."). This action is public and
  // unauthenticated, and warnings[] is returned verbatim in the JSON response, so the
  // mapped warning must use the path-free e.message instead.
  const { warnings } = compile('<mjml><mj-body><mj-button>x</mj-button></mj-body></mjml>');
  assert.ok(warnings.length >= 1);
  const [warning] = warnings;
  assert.ok(!warning.includes(process.cwd()), `warning leaked process.cwd(): ${warning}`);
  assert.doesNotMatch(warning, /\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/, 'warning contains an absolute path');
  // The useful core text must survive the switch away from formattedMessage.
  assert.match(warning, /mj-button cannot be used inside mj-body/);
});
