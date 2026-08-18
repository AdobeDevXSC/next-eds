import test from 'node:test';
import assert from 'node:assert/strict';
import { renderShell } from '../actions/convert-email/render/shell.js';

test('wraps body in a full MJML document with preheader', () => {
  const doc = renderShell({ body: '<mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section>', preheader: 'Peek' });
  assert.match(doc, /^<mjml>/);
  assert.match(doc, /<mj-body[^>]*width="600px"/);
  assert.match(doc, /Peek/);
  assert.match(doc, /<mj-text>Hi<\/mj-text>/);
  assert.match(doc, /<\/mjml>$/);
});

test('defaults preheader to empty and still produces a valid shell', () => {
  const doc = renderShell({ body: '' });
  assert.match(doc, /<mj-body/);
  assert.match(doc, /<\/mj-body>/);
});

test('entity-encodes a hostile preheader (script tag + ampersand)', () => {
  const doc = renderShell({ body: '', preheader: '<script>alert(1)</script> & Co' });
  assert.ok(!doc.includes('<script>alert(1)</script> & Co'));
  assert.doesNotMatch(doc, /<script>alert\(1\)<\/script>/);
  assert.match(doc, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(doc, /&amp; Co/);
});
