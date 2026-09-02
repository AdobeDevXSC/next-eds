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

// The eyebrow's own bottom margin plus the following heading's default top margin were
// stacking into a visibly oversized gap between e.g. "GEAR · GUNS" and its headline —
// confirmed against the real rendered osg/the-weekly page. Drop h5's own bottom margin and
// zero out the immediately-following heading's top margin so an eyebrow sits tight against
// whatever it's labeling, regardless of which heading level a block happens to use.
test('h5 has no bottom margin, and an immediately-following heading has no top margin', () => {
  const doc = renderShell({ body: '<mj-text><h5>Gear · Guns</h5><h2>Title</h2></mj-text>' });
  assert.match(doc, /h5 \{[^}]*margin: 16px 0 0;[^}]*\}/);
  assert.match(doc, /h5 \+ h1, h5 \+ h2, h5 \+ h3, h5 \+ h4 \{ margin-top: 0; \}/);
});

// Consecutive <p>s land inside the same <mj-text> (contentToMjml only flushes on an
// image/button), so the browser default ~1em top+bottom <p> margin was doubling up between
// them — e.g. body copy to byline had a much bigger gap than intended. Drop the top margin
// entirely and keep a modest bottom margin as the only separator between paragraphs.
test('paragraphs have no top margin, just a modest bottom margin', () => {
  const doc = renderShell({ body: '<mj-text><p>Body</p><p>Byline</p></mj-text>' });
  assert.match(doc, /p \{ margin: 0 0 12px; \}/);
});

// lib/eds/parse.js gives every direct child of a section its own default-content node
// (see parseEds), so plain sibling elements like an intro's <h1>/<p>/<h5> each land in their
// own <mj-section> rather than sharing one — and MJML's own default section padding
// (20px top+bottom) was stacking on top of each element's own margin between every one of
// those, producing a much bigger gap than the paragraph/heading margins alone would suggest.
// Only a smaller shared default, set once here, fixes that without touching every block
// template that doesn't already set its own explicit section padding.
test('mj-section defaults to a tighter 10px vertical padding than MJML\'s own 20px default', () => {
  const doc = renderShell({ body: '<mj-section><mj-column><mj-text>Hi</mj-text></mj-column></mj-section>' });
  assert.match(doc, /<mj-section padding="10px 0" \/>/);
});
