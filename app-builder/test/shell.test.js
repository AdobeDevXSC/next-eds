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

// h5 is the semantic hook for an "eyebrow"/kicker label (a small caps, letter-spaced
// category tag above a headline — e.g. "GEAR · GUNS") — a common editorial pattern any
// site's blocks can opt into just by tagging that text as <h5>, with no per-site template
// change needed. This is a global, cross-site default (like the existing `a` color rule
// above it), not one customer's brand color — sites wanting a different eyebrow color need
// the per-site theme override mechanism, which doesn't exist yet.
test('h5 gets eyebrow/kicker styling: small caps, letter-spaced, colored', () => {
  const doc = renderShell({ body: '<mj-text><h5>Gear · Guns</h5></mj-text>' });
  assert.match(doc, /h5 \{[^}]*text-transform: uppercase;[^}]*\}/);
  assert.match(doc, /h5 \{[^}]*letter-spacing: 2px;[^}]*\}/);
  assert.match(doc, /h5 \{[^}]*font-weight: bold;[^}]*\}/);
});
