# EDS page → email HTML App Builder action — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Phase-1 Adobe App Builder (I/O Runtime) action that takes an EDS page path, fetches its delivered `.plain.html`, and returns bulletproof email HTML (no sending).

**Architecture:** A self-contained `app-builder/` app co-located in this repo. A web action orchestrates a pure pipeline: `fetchPlainHtml` → reuse the repo's `parseEds` (`lib/eds/parse.js`) → `normalizeTree` (picture→img, absolutize URLs, strip scripts) → per-block MJML renderers → `mjml2html` compile. Each stage is a pure, independently tested function.

**Tech Stack:** Node.js 20, ESM. Dependencies: `mjml` (Outlook-safe HTML generation), `node-html-parser` (same parser the Next app uses). Tests: built-in `node:test` + `node:assert` (no test-framework dependency).

## Global Constraints

- **Node 20, ESM.** `app-builder/package.json` has `"type": "module"`. Every relative import includes the `.js` extension (matches AGENTS.md).
- **Dependencies limited to `mjml` + `node-html-parser`.** No other runtime deps. Tests use `node:test`/`node:assert` only.
- **Reuse `lib/eds/parse.js` read-only.** Import `parseEds` from `../../../../lib/eds/parse.js` (relative from `actions/convert-email/`). Do **not** modify it or anything under `app/` or `lib/`.
- **Unknown or malformed blocks never throw.** They are skipped and recorded in `warnings[]`.
- **Email invariants:** 600px body width; all asset/link URLs absolute; no `<script>` in output.
- **Entity-encoding:** dynamic values (URLs, `alt`, text) interpolated into any markup string MUST be HTML entity-encoded via the shared `escape.js` (`escapeAttr`/`escapeText`). Every stage that serializes to a string escapes, because every parse stage (`node-html-parser`, then `mjml2html`) decodes — so escaping once per serialization is balanced and does not double-encode. Verify `node-html-parser`'s decode-on-parse behavior empirically and cover the `&`-in-URL and `&`-in-`alt` cases with tests. Applies to Tasks 3, 5, 6–9.
- **EDS origin defaults** mirror `lib/eds/fetch.js`: preview `https://main--next-eds--AdobeDevXSC.aem.page`, live `https://main--next-eds--AdobeDevXSC.aem.live`.
- **`app-builder/` is outside the repo's root lint globs** (`blocks/**`, `styles/*`, `app/**`) by design — it has its own toolchain. Match the repo's JS style anyway (ES6+, LF line endings, single quotes).
- **All commits end with the trailer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Spec:** `docs/superpowers/specs/2026-08-18-eds-to-email-action-design.md`.

---

## File Structure

```
app-builder/
  package.json                     # Task 1  — type:module, deps, test script
  app.config.yaml                  # Task 1  — Adobe I/O Runtime action manifest
  actions/convert-email/
    fetch.js                       # Task 2  — resolveOrigin, fetchPlainHtml
    escape.js                      # Task 3  — escapeAttr, escapeText (shared HTML entity-encoding)
    normalize.js                   # Task 3  — normalizeHtml, normalizeTree
    render/
      shell.js                     # Task 4  — renderShell (full MJML doc)
      blocks/
        content.js                 # Task 5  — contentToMjml (shared inline renderer)
        default.js                 # Task 5  — renderDefault
        hero.js                    # Task 6  — renderHero
        cards.js                   # Task 7  — renderCards
        columns.js                 # Task 8  — renderColumns
        callout.js                 # Task 9  — renderCallout
      index.js                     # Task 10 — renderDocument (tree → MJML doc)
    compile.js                     # Task 11 — compile (mjml2html wrapper)
    pipeline.js                    # Task 12 — convert() end-to-end (pure)
    index.js                       # Task 13 — main(params) web-action entrypoint
    send.js                        # Task 13 — Phase-2 stub (throws)
  test/
    fixtures/sample.plain.html     # Task 12 — end-to-end fixture
    *.test.js                      # per task
```

Reused from repo root: `lib/eds/parse.js` (`parseEds`).

---

## Task 1: Scaffold the App Builder app + test runner

**Files:**
- Create: `app-builder/package.json`
- Create: `app-builder/app.config.yaml`
- Create: `app-builder/test/smoke.test.js`
- Modify: `.gitignore` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` (via `node --test`) inside `app-builder/`, and installed deps `mjml` + `node-html-parser`.

- [ ] **Step 1: Create `app-builder/package.json`**

```json
{
  "name": "next-eds-email-action",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Adobe I/O Runtime action: EDS page → email HTML",
  "scripts": {
    "test": "node --test"
  },
  "dependencies": {
    "mjml": "^4.15.3",
    "node-html-parser": "7.0.1"
  }
}
```

- [ ] **Step 2: Create `app-builder/app.config.yaml`**

```yaml
application:
  runtimeManifest:
    packages:
      email:
        license: Apache-2.0
        actions:
          convert-email:
            function: actions/convert-email/index.js
            web: 'yes'
            runtime: nodejs:20
            inputs:
              EDS_ORIGIN_PREVIEW: https://main--next-eds--AdobeDevXSC.aem.page
              EDS_ORIGIN_LIVE: https://main--next-eds--AdobeDevXSC.aem.live
            annotations:
              require-adobe-auth: false
              final: true
```

- [ ] **Step 3: Append to root `.gitignore`**

```
# App Builder
app-builder/node_modules
app-builder/dist
app-builder/.env
```

- [ ] **Step 4: Create `app-builder/test/smoke.test.js`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('test runner works', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 5: Install deps and run the smoke test**

Run:
```bash
cd app-builder && npm install && npm test
```
Expected: `node install` completes; test output shows `tests 1` / `pass 1`.

- [ ] **Step 6: Commit**

```bash
git add app-builder/package.json app-builder/app.config.yaml app-builder/test/smoke.test.js app-builder/package-lock.json .gitignore
git commit -m "chore(email): scaffold App Builder email action + test runner"
```

---

## Task 2: `fetch.js` — fetch `.plain.html` with env origin selection

**Files:**
- Create: `app-builder/actions/convert-email/fetch.js`
- Test: `app-builder/test/fetch.test.js`

**Interfaces:**
- Consumes: global `fetch`, `Response` (Node 20).
- Produces:
  - `resolveOrigin(env, origins) → string` where `origins = { preview, live }`.
  - `async fetchPlainHtml(path, { env, origins }) → Promise<string|null>` (null on 404).

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrigin, fetchPlainHtml } from '../actions/convert-email/fetch.js';

const ORIGINS = { preview: 'https://p.example', live: 'https://l.example' };

test('resolveOrigin picks live vs preview', () => {
  assert.equal(resolveOrigin('live', ORIGINS), 'https://l.example');
  assert.equal(resolveOrigin('preview', ORIGINS), 'https://p.example');
  assert.equal(resolveOrigin(undefined, ORIGINS), 'https://p.example');
});

test('fetchPlainHtml builds the .plain.html URL and returns body', async () => {
  let called = '';
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => { called = url; return new Response('<div></div>', { status: 200 }); };
  try {
    const html = await fetchPlainHtml('/menu/cubano', { env: 'live', origins: ORIGINS });
    assert.equal(called, 'https://l.example/menu/cubano.plain.html');
    assert.equal(html, '<div></div>');
  } finally { globalThis.fetch = orig; }
});

test('fetchPlainHtml maps empty path to index and 404 to null', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 404 });
  try {
    assert.equal(await fetchPlainHtml('', { env: 'preview', origins: ORIGINS }), null);
  } finally { globalThis.fetch = orig; }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app-builder && node --test test/fetch.test.js`
Expected: FAIL — cannot find module `fetch.js` / export not defined.

- [ ] **Step 3: Write minimal implementation**

```js
// Fetch the delivered semantic .plain.html for an EDS page.
// Mirrors lib/eds/fetch.js's path/404 behavior, but env-selectable and
// dependency-free (URL rewriting is normalize.js's job, not this module's).

const DEFAULT_ORIGINS = {
  preview: 'https://main--next-eds--AdobeDevXSC.aem.page',
  live: 'https://main--next-eds--AdobeDevXSC.aem.live',
};

export function resolveOrigin(env, origins = DEFAULT_ORIGINS) {
  return env === 'live' ? origins.live : origins.preview;
}

export async function fetchPlainHtml(path = '', { env = 'preview', origins = DEFAULT_ORIGINS } = {}) {
  const clean = String(path).replace(/^\/+/, '');
  const rel = clean ? `${clean}.plain.html` : 'index.plain.html';
  const origin = resolveOrigin(env, origins);
  const res = await fetch(`${origin}/${rel}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`EDS fetch failed: ${res.status} for /${rel}`);
  return res.text();
}

export { DEFAULT_ORIGINS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app-builder && node --test test/fetch.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app-builder/actions/convert-email/fetch.js app-builder/test/fetch.test.js
git commit -m "feat(email): fetch .plain.html with env origin selection"
```

---

## Task 3: `normalize.js` — email-safe HTML + tree normalization

**Files:**
- Create: `app-builder/actions/convert-email/escape.js` (shared HTML entity-encoding)
- Create: `app-builder/actions/convert-email/normalize.js`
- Test: `app-builder/test/escape.test.js`
- Test: `app-builder/test/normalize.test.js`

**Interfaces:**
- Consumes: `parse` from `node-html-parser`; `escapeAttr` from `./escape.js`.
- Produces:
  - `escapeAttr(str) → string` — entity-encode `&<>"` for use in an HTML attribute value.
  - `escapeText(str) → string` — entity-encode `&<>` for use in HTML text content.
  - `normalizeHtml(html, origin) → string` — collapse `<picture>`→`<img>`, strip `<script>`, absolutize `src`/`href`. All values interpolated into markup (the collapsed `<img>`'s `src`/`alt`, and absolutized attribute values) are entity-encoded via `escapeAttr`, so the returned string is valid HTML and survives re-parsing without `&`-corruption.
  - `normalizeTree(tree, origin) → tree` — apply `normalizeHtml` to `default.html` and each `block.rows[][].html` (returns the same tree, mutated). Does not rewrite raw `block.html` (never rendered downstream).

**Encoding requirement (added after Task 3 review — Global Constraint "Entity-encoding"):** `normalizeHtml` must not emit a raw `&` into an attribute value, and must not let a legacy entity in author text (e.g. `alt="Acme&reg Widget"`) be silently decoded. Add tests: a URL with ≥2 query params → `&amp;` in output; an `alt`/href value containing `&reg`/`&copy` round-trips through `normalizeHtml` (and a second `parse`) without becoming `®`/`©`. Confirm no double-encoding (no `&amp;amp;`).

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHtml, normalizeTree } from '../actions/convert-email/normalize.js';

const ORIGIN = 'https://eds.example';

test('collapses <picture> to a single absolute <img>', () => {
  const out = normalizeHtml(
    '<picture><source srcset="./media_a.webp?width=750"><img src="./media_a.png?width=750" alt="Hi"></picture>',
    ORIGIN,
  );
  assert.match(out, /<img[^>]+src="https:\/\/eds\.example\/media_a\.png\?width=750"/);
  assert.match(out, /alt="Hi"/);
  assert.doesNotMatch(out, /<picture|<source/);
});

test('absolutizes root-relative and bare links, strips scripts', () => {
  const out = normalizeHtml('<a href="/menu">m</a><a href="x/y">y</a><script>bad()</script>', ORIGIN);
  assert.match(out, /href="https:\/\/eds\.example\/menu"/);
  assert.match(out, /href="https:\/\/eds\.example\/x\/y"/);
  assert.doesNotMatch(out, /script/);
});

test('leaves absolute, anchor, and mailto links untouched', () => {
  const out = normalizeHtml('<a href="https://x.com">a</a><a href="#top">b</a><a href="mailto:h@x">c</a>', ORIGIN);
  assert.match(out, /href="https:\/\/x\.com"/);
  assert.match(out, /href="#top"/);
  assert.match(out, /href="mailto:h@x"/);
});

test('normalizeTree rewrites default nodes and block cells', () => {
  const tree = [{
    kind: 'section',
    styles: [],
    children: [
      { kind: 'default', html: '<a href="/a">a</a>' },
      { kind: 'block', name: 'hero', variants: [], html: '', rows: [[{ html: '<a href="/b">b</a>', pictureOnly: false }]] },
    ],
  }];
  normalizeTree(tree, ORIGIN);
  assert.match(tree[0].children[0].html, /href="https:\/\/eds\.example\/a"/);
  assert.match(tree[0].children[1].rows[0][0].html, /href="https:\/\/eds\.example\/b"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app-builder && node --test test/normalize.test.js`
Expected: FAIL — module/exports not defined.

- [ ] **Step 3: Write minimal implementation**

```js
import { parse } from 'node-html-parser';

function absolutize(url, origin) {
  if (!url) return url;
  const v = url.trim();
  if (/^(https?:)?\/\//i.test(v) || /^(mailto:|tel:|#|data:)/i.test(v)) return v;
  if (v.startsWith('/')) return `${origin}${v}`;
  if (v.startsWith('./')) return `${origin}/${v.slice(2)}`;
  return `${origin}/${v}`;
}

export function normalizeHtml(html, origin) {
  if (!html) return '';
  const root = parse(html);

  // <picture> → <img> (email needs one static, absolute image, not srcset sources).
  root.querySelectorAll('picture').forEach((pic) => {
    const img = pic.querySelector('img');
    const src = absolutize(img?.getAttribute('src') || '', origin);
    const alt = (img?.getAttribute('alt') || '').replace(/"/g, '&quot;');
    pic.insertAdjacentHTML('afterend', `<img src="${src}" alt="${alt}" />`);
    pic.remove();
  });

  // Strip scripts.
  root.querySelectorAll('script').forEach((s) => s.remove());

  // Absolutize remaining src/href.
  root.querySelectorAll('[src]').forEach((el) => el.setAttribute('src', absolutize(el.getAttribute('src'), origin)));
  root.querySelectorAll('[href]').forEach((el) => el.setAttribute('href', absolutize(el.getAttribute('href'), origin)));

  return root.toString();
}

export function normalizeTree(tree, origin) {
  tree.forEach((section) => {
    section.children.forEach((node) => {
      if (node.kind === 'default') {
        node.html = normalizeHtml(node.html, origin);
      } else if (node.kind === 'block') {
        node.rows = (node.rows || []).map((row) => row.map((cell) => ({
          ...cell,
          html: normalizeHtml(cell.html, origin),
        })));
      }
    });
  });
  return tree;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app-builder && node --test test/normalize.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app-builder/actions/convert-email/normalize.js app-builder/test/normalize.test.js
git commit -m "feat(email): normalize delivered HTML for email (picture/urls/scripts)"
```

---

## Task 4: `render/shell.js` — the MJML document shell

**Files:**
- Create: `app-builder/actions/convert-email/render/shell.js`
- Test: `app-builder/test/shell.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `renderShell({ body, preheader }) → string` — a complete `<mjml>…</mjml>` document string with `<mj-head>` defaults (600px width, web-safe fonts), a hidden preheader span, and `body` (MJML section fragments) injected into `<mj-body>`.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app-builder && node --test test/shell.test.js`
Expected: FAIL — export not defined.

- [ ] **Step 3: Write minimal implementation**

```js
// The one place that owns the cross-cutting email frame: width, fonts, colors, preheader.
const FONT_STACK = "Helvetica, Arial, sans-serif";

export function renderShell({ body = '', preheader = '' } = {}) {
  return `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="${FONT_STACK}" />
      <mj-text font-size="16px" line-height="1.5" color="#1a1a1a" />
      <mj-button background-color="#1a1a1a" color="#ffffff" font-weight="bold" border-radius="4px" />
    </mj-attributes>
    <mj-style>a { color: #1a1a1a; }</mj-style>
  </mj-head>
  <mj-body width="600px" background-color="#ffffff">
    <mj-raw><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div></mj-raw>
    ${body}
  </mj-body>
</mjml>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app-builder && node --test test/shell.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app-builder/actions/convert-email/render/shell.js app-builder/test/shell.test.js
git commit -m "feat(email): MJML document shell (width, fonts, preheader)"
```

---

## Task 5: `render/blocks/content.js` + `default.js` — shared inline renderer + default content

**Files:**
- Create: `app-builder/actions/convert-email/render/blocks/content.js`
- Create: `app-builder/actions/convert-email/render/blocks/default.js`
- Test: `app-builder/test/content.test.js`

**Interfaces:**
- Consumes: `parse` from `node-html-parser`; `escapeAttr`, `escapeText` from `../../escape.js` (Task 3).
- Produces:
  - `contentToMjml(html) → string` — a sequence of `<mj-text>` / `<mj-button>` / `<mj-image>` fragments (NOT wrapped in section/column). Used by every block renderer. Images (already `<img>` after normalize) → `mj-image`; CTA paragraphs (a `<p class="button-container">` or a `<p>` whose text is entirely links) → one `mj-button` per link; everything else accrues into `mj-text`. All extracted attribute values (`src`, `href`, `alt`) are wrapped in `escapeAttr` and button link text in `escapeText` when interpolated into the MJML strings (Global Constraint "Entity-encoding"). Add a test that a value with `&` (e.g. a UTM `href` or a multi-param image `src`) run through the full `normalizeHtml → parse → contentToMjml` path is singly-encoded in the output (a `&amp;`, never a raw `&` and never `&amp;amp;`).
  - `renderDefault(node) → string` — `node = { kind:'default', html }` wrapped in `<mj-section><mj-column>…</mj-column></mj-section>`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentToMjml } from '../actions/convert-email/render/blocks/content.js';
import { renderDefault } from '../actions/convert-email/render/blocks/default.js';

test('plain prose becomes a single mj-text', () => {
  const out = contentToMjml('<h2>Title</h2><p>Body</p>');
  assert.match(out, /<mj-text><h2>Title<\/h2><p>Body<\/p><\/mj-text>/);
  assert.doesNotMatch(out, /mj-button/);
});

test('button-container paragraph becomes mj-button, split from text', () => {
  const out = contentToMjml('<p>Intro</p><p class="button-container"><a href="https://x/go">Go</a></p>');
  assert.match(out, /<mj-text><p>Intro<\/p><\/mj-text>/);
  assert.match(out, /<mj-button href="https:\/\/x\/go">Go<\/mj-button>/);
});

test('img becomes mj-image', () => {
  const out = contentToMjml('<img src="https://x/a.png" alt="A" />');
  assert.match(out, /<mj-image src="https:\/\/x\/a\.png" alt="A"/);
});

test('renderDefault wraps content in a section+column', () => {
  const out = renderDefault({ kind: 'default', html: '<p>Hi</p>' });
  assert.match(out, /^<mj-section><mj-column><mj-text><p>Hi<\/p><\/mj-text><\/mj-column><\/mj-section>$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app-builder && node --test test/content.test.js`
Expected: FAIL — exports not defined.

- [ ] **Step 3: Write minimal implementation**

`render/blocks/content.js`:
```js
import { parse } from 'node-html-parser';
import { escapeAttr, escapeText } from '../../escape.js';

// A CTA paragraph: explicit button-container, or a <p> whose entire text is links.
function isButtonPara(el) {
  if (el.tagName !== 'P') return false;
  const links = el.querySelectorAll('a');
  if (links.length === 0) return false;
  if (el.classList.contains('button-container')) return true;
  if (links.some((a) => a.classList.contains('button'))) return true;
  const linkText = links.map((a) => a.textContent.trim()).join(' ').trim();
  return el.textContent.trim() === linkText;
}

export function contentToMjml(html) {
  const root = parse(html || '');
  const out = [];
  let buffer = [];
  const flush = () => {
    const inner = buffer.join('').trim();
    if (inner) out.push(`<mj-text>${inner}</mj-text>`);
    buffer = [];
  };
  root.childNodes.forEach((node) => {
    if (!node.tagName) { // text node
      if (node.text && node.text.trim()) buffer.push(node.text);
      return;
    }
    const tag = node.tagName;
    if (tag === 'IMG' || tag === 'PICTURE') {
      flush();
      const img = tag === 'IMG' ? node : node.querySelector('img');
      const src = img?.getAttribute('src') || '';
      const alt = img?.getAttribute('alt') || '';
      out.push(`<mj-image src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" />`);
    } else if (isButtonPara(node)) {
      flush();
      node.querySelectorAll('a').forEach((a) => {
        out.push(`<mj-button href="${escapeAttr(a.getAttribute('href') || '#')}">${escapeText(a.textContent.trim())}</mj-button>`);
      });
    } else {
      buffer.push(node.outerHTML);
    }
  });
  flush();
  return out.join('');
}
```

`render/blocks/default.js`:
```js
import { contentToMjml } from './content.js';

export function renderDefault(node) {
  return `<mj-section><mj-column>${contentToMjml(node.html)}</mj-column></mj-section>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app-builder && node --test test/content.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app-builder/actions/convert-email/render/blocks/content.js app-builder/actions/convert-email/render/blocks/default.js app-builder/test/content.test.js
git commit -m "feat(email): shared inline content renderer + default-content block"
```

---

## Task 6: `render/blocks/hero.js` — hero block

**Files:**
- Create: `app-builder/actions/convert-email/render/blocks/hero.js`
- Test: `app-builder/test/hero.test.js`

**Interfaces:**
- Consumes: `contentToMjml` from `./content.js`.
- Produces: `renderHero(block) → string`. The canonical EDS hero is one row / one cell containing a picture + heading + paragraphs (+ CTA); render that cell's content into a centered full-width section.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app-builder && node --test test/hero.test.js`
Expected: FAIL — export not defined.

- [ ] **Step 3: Write minimal implementation**

```js
import { contentToMjml } from './content.js';

export function renderHero(block) {
  const html = block.rows?.[0]?.[0]?.html || '';
  return `<mj-section padding="0"><mj-column>${contentToMjml(html)}</mj-column></mj-section>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app-builder && node --test test/hero.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app-builder/actions/convert-email/render/blocks/hero.js app-builder/test/hero.test.js
git commit -m "feat(email): hero block email renderer"
```

---

## Task 7: `render/blocks/cards.js` — cards block

**Files:**
- Create: `app-builder/actions/convert-email/render/blocks/cards.js`
- Test: `app-builder/test/cards.test.js`

**Interfaces:**
- Consumes: `contentToMjml` from `./content.js`.
- Produces: `renderCards(block) → string`. Each EDS card is one row (cells joined); render cards two-up per `mj-section` (they stack on mobile automatically).

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app-builder && node --test test/cards.test.js`
Expected: FAIL — export not defined.

- [ ] **Step 3: Write minimal implementation**

```js
import { contentToMjml } from './content.js';

const PER_ROW = 2;

export function renderCards(block) {
  const rows = block.rows || [];
  const columns = rows.map((cells) => {
    const html = cells.map((c) => c.html).join('');
    return `<mj-column>${contentToMjml(html)}</mj-column>`;
  });
  const sections = [];
  for (let i = 0; i < columns.length; i += PER_ROW) {
    sections.push(`<mj-section>${columns.slice(i, i + PER_ROW).join('')}</mj-section>`);
  }
  return sections.join('');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app-builder && node --test test/cards.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app-builder/actions/convert-email/render/blocks/cards.js app-builder/test/cards.test.js
git commit -m "feat(email): cards block email renderer (2-up, stacks on mobile)"
```

---

## Task 8: `render/blocks/columns.js` — columns block

**Files:**
- Create: `app-builder/actions/convert-email/render/blocks/columns.js`
- Test: `app-builder/test/columns.test.js`

**Interfaces:**
- Consumes: `contentToMjml` from `./content.js`.
- Produces: `renderColumns(block) → string`. EDS columns is one row of N cells → one `mj-section` of N `mj-column`s.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app-builder && node --test test/columns.test.js`
Expected: FAIL — export not defined.

- [ ] **Step 3: Write minimal implementation**

```js
import { contentToMjml } from './content.js';

export function renderColumns(block) {
  const cells = block.rows?.[0] || [];
  if (cells.length === 0) return '';
  const columns = cells.map((c) => `<mj-column>${contentToMjml(c.html)}</mj-column>`).join('');
  return `<mj-section>${columns}</mj-section>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app-builder && node --test test/columns.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app-builder/actions/convert-email/render/blocks/columns.js app-builder/test/columns.test.js
git commit -m "feat(email): columns block email renderer"
```

---

## Task 9: `render/blocks/callout.js` — callout block

**Files:**
- Create: `app-builder/actions/convert-email/render/blocks/callout.js`
- Test: `app-builder/test/callout.test.js`

**Interfaces:**
- Consumes: `contentToMjml` from `./content.js`.
- Produces: `renderCallout(block) → string`. A background-tinted section wrapping the first cell's content (heading/text + CTA).

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app-builder && node --test test/callout.test.js`
Expected: FAIL — export not defined.

- [ ] **Step 3: Write minimal implementation**

```js
import { contentToMjml } from './content.js';

export function renderCallout(block) {
  const html = block.rows?.[0]?.[0]?.html || '';
  return `<mj-section background-color="#f4f4f4" padding="24px"><mj-column>${contentToMjml(html)}</mj-column></mj-section>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app-builder && node --test test/callout.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-builder/actions/convert-email/render/blocks/callout.js app-builder/test/callout.test.js
git commit -m "feat(email): callout block email renderer"
```

---

## Task 10: `render/index.js` — assemble the MJML document

**Files:**
- Create: `app-builder/actions/convert-email/render/index.js`
- Test: `app-builder/test/render-document.test.js`

**Interfaces:**
- Consumes: `renderShell` (Task 4); `renderDefault` (Task 5); `renderHero` (Task 6); `renderCards` (Task 7); `renderColumns` (Task 8); `renderCallout` (Task 9).
- Produces: `renderDocument(tree, { preheader }) → { mjml, warnings, blocksRendered }`. Walks sections in document order; default nodes → `renderDefault`; known blocks → their renderer; unknown blocks → skipped with a `warnings[]` entry. `blocksRendered` lists the block names that produced output.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app-builder && node --test test/render-document.test.js`
Expected: FAIL — export not defined.

- [ ] **Step 3: Write minimal implementation**

```js
import { renderShell } from './shell.js';
import { renderDefault } from './blocks/default.js';
import { renderHero } from './blocks/hero.js';
import { renderCards } from './blocks/cards.js';
import { renderColumns } from './blocks/columns.js';
import { renderCallout } from './blocks/callout.js';

const BLOCKS = {
  hero: renderHero,
  cards: renderCards,
  columns: renderColumns,
  callout: renderCallout,
};

export function renderDocument(tree, { preheader = '' } = {}) {
  const warnings = [];
  const blocksRendered = [];
  const parts = [];

  tree.forEach((section) => {
    section.children.forEach((node) => {
      if (node.kind === 'default') {
        parts.push(renderDefault(node));
        return;
      }
      const renderer = BLOCKS[node.name];
      if (!renderer) {
        warnings.push(`block '${node.name}' omitted (not emailable)`);
        return;
      }
      try {
        const fragment = renderer(node);
        if (fragment) { parts.push(fragment); blocksRendered.push(node.name); }
      } catch (err) {
        warnings.push(`block '${node.name}' failed to render: ${err.message}`);
      }
    });
  });

  return { mjml: renderShell({ body: parts.join('\n'), preheader }), warnings, blocksRendered };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app-builder && node --test test/render-document.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-builder/actions/convert-email/render/index.js app-builder/test/render-document.test.js
git commit -m "feat(email): assemble MJML document from normalized tree"
```

---

## Task 11: `compile.js` — MJML → HTML

**Files:**
- Create: `app-builder/actions/convert-email/compile.js`
- Test: `app-builder/test/compile.test.js`

**Interfaces:**
- Consumes: `mjml` package (default export `mjml2html`).
- Produces: `compile(mjmlString) → { html, warnings }`. Uses soft validation so unusual markup produces warnings, not throws. `warnings` is an array of human-readable strings.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app-builder && node --test test/compile.test.js`
Expected: FAIL — export not defined.

- [ ] **Step 3: Write minimal implementation**

```js
import mjml2html from 'mjml';

export function compile(mjmlString) {
  const { html, errors } = mjml2html(mjmlString, {
    validationLevel: 'soft',
    minify: false,
  });
  const warnings = (errors || []).map((e) => e.formattedMessage || e.message);
  return { html, warnings };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app-builder && node --test test/compile.test.js`
Expected: PASS. (If the `mj-button`-at-root case emits zero soft warnings in the installed MJML version, replace the illegal markup in the test with `<mjml><mj-body><mj-column><mj-text>x</mj-text></mj-column></mj-body></mjml>` — a column outside a section — which reliably warns.)

- [ ] **Step 5: Commit**

```bash
git add app-builder/actions/convert-email/compile.js app-builder/test/compile.test.js
git commit -m "feat(email): compile MJML to Outlook-safe HTML"
```

---

## Task 12: `pipeline.js` — end-to-end conversion (pure) + fixture

**Files:**
- Create: `app-builder/actions/convert-email/pipeline.js`
- Create: `app-builder/test/fixtures/sample.plain.html`
- Test: `app-builder/test/pipeline.test.js`

**Interfaces:**
- Consumes: `fetchPlainHtml`, `resolveOrigin` (Task 2); `parseEds` from `../../../../lib/eds/parse.js`; `normalizeTree` (Task 3); `renderDocument` (Task 10); `compile` (Task 11).
- Produces: `async convert({ path, env, origins, preheader, subject }) → { html, subject, preheader, warnings, blocksRendered }`. Returns `null` if the page is a 404. `warnings` merges render + compile warnings. Phase 1: `subject`/`preheader` are pass-through only (default empty).

- [ ] **Step 1: Create the fixture `app-builder/test/fixtures/sample.plain.html`**

```html
<body>
  <div>
    <div class="hero">
      <div><div>
        <picture><source srcset="./media_hero.webp?width=1200"><img src="./media_hero.png?width=1200" alt="Stacked"></picture>
        <h1>Stacked</h1>
        <p>Build your lunch, brick by brick.</p>
        <p class="button-container"><a href="/menu" class="button">See the menu</a></p>
      </div></div>
    </div>
    <div>
      <h2>Fresh every day</h2>
      <p>Locally sourced ingredients.</p>
    </div>
    <div class="cards">
      <div><div><picture><img src="./media_c1.png?width=750" alt="Caprese"></picture></div><div><p>Caprese</p></div></div>
      <div><div><picture><img src="./media_c2.png?width=750" alt="Cubano"></picture></div><div><p>Cubano</p></div></div>
    </div>
    <div class="form">
      <div><div>Newsletter signup</div></div>
    </div>
  </div>
</body>
```

- [ ] **Step 2: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { convert } from '../actions/convert-email/pipeline.js';

const fixture = readFileSync(fileURLToPath(new URL('./fixtures/sample.plain.html', import.meta.url)), 'utf8');
const ORIGINS = { preview: 'https://eds.example', live: 'https://eds.example' };

test('converts a fixture page end-to-end to email HTML', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(fixture, { status: 200 });
  try {
    const result = await convert({ path: '/home', env: 'preview', origins: ORIGINS, preheader: 'Lunch time' });
    assert.match(result.html, /<table/);              // compiled to tables
    assert.match(result.html, /Stacked/);             // hero heading
    assert.match(result.html, /Fresh every day/);     // default content
    assert.match(result.html, /Caprese/);             // cards
    assert.match(result.html, /eds\.example\/media_hero\.png/); // absolutized image
    assert.doesNotMatch(result.html, /Newsletter signup/);      // form omitted
    assert.ok(result.warnings.some((w) => /form/.test(w)));
    assert.deepEqual(result.blocksRendered.sort(), ['cards', 'hero']);
    assert.equal(result.preheader, 'Lunch time');
  } finally { globalThis.fetch = orig; }
});

test('returns null for a 404 page', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 404 });
  try {
    assert.equal(await convert({ path: '/missing', env: 'preview', origins: ORIGINS }), null);
  } finally { globalThis.fetch = orig; }
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app-builder && node --test test/pipeline.test.js`
Expected: FAIL — export not defined.

- [ ] **Step 4: Write minimal implementation**

```js
import { parseEds } from '../../../../lib/eds/parse.js';
import { fetchPlainHtml, resolveOrigin } from './fetch.js';
import { normalizeTree } from './normalize.js';
import { renderDocument } from './render/index.js';
import { compile } from './compile.js';

export async function convert({ path, env = 'preview', origins, preheader = '', subject = '' } = {}) {
  const html = await fetchPlainHtml(path, { env, origins });
  if (html === null) return null;

  const origin = resolveOrigin(env, origins);
  const tree = normalizeTree(parseEds(html), origin);
  const { mjml, warnings: renderWarnings, blocksRendered } = renderDocument(tree, { preheader });
  const { html: emailHtml, warnings: compileWarnings } = compile(mjml);

  return {
    html: emailHtml,
    subject,
    preheader,
    warnings: [...renderWarnings, ...compileWarnings],
    blocksRendered,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app-builder && node --test test/pipeline.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add app-builder/actions/convert-email/pipeline.js app-builder/test/fixtures/sample.plain.html app-builder/test/pipeline.test.js
git commit -m "feat(email): end-to-end EDS-page-to-email pipeline"
```

---

## Task 13: `index.js` (web action entrypoint) + `send.js` (Phase-2 stub)

**Files:**
- Create: `app-builder/actions/convert-email/index.js`
- Create: `app-builder/actions/convert-email/send.js`
- Test: `app-builder/test/main.test.js`

**Interfaces:**
- Consumes: `convert` from `./pipeline.js`.
- Produces:
  - `async main(params) → { statusCode, headers?, body }` — the Adobe I/O web action. Reads `path` (required), `env`, `preview`, `subject`, `preheader`, and origin overrides `EDS_ORIGIN_PREVIEW`/`EDS_ORIGIN_LIVE` (injected by `app.config.yaml`). `preview=true` returns `Content-Type: text/html`; otherwise JSON `{ html, subject, preheader, warnings, meta }`.
  - `async send({ to, subject, html })` — Phase-2 seam; throws `Error('send() is Phase 2 — not implemented')`.

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { main } from '../actions/convert-email/index.js';
import { send } from '../actions/convert-email/send.js';

const fixture = readFileSync(fileURLToPath(new URL('./fixtures/sample.plain.html', import.meta.url)), 'utf8');

test('missing path → 400', async () => {
  const res = await main({});
  assert.equal(res.statusCode, 400);
});

test('happy path → 200 JSON with html + meta', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(fixture, { status: 200 });
  try {
    const res = await main({ path: '/home', EDS_ORIGIN_PREVIEW: 'https://eds.example' });
    assert.equal(res.statusCode, 200);
    assert.match(res.body.html, /<table/);
    assert.equal(res.body.meta.path, '/home');
    assert.ok(res.body.warnings.some((w) => /form/.test(w)));
  } finally { globalThis.fetch = orig; }
});

test('preview=true → text/html response', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response(fixture, { status: 200 });
  try {
    const res = await main({ path: '/home', preview: 'true', EDS_ORIGIN_PREVIEW: 'https://eds.example' });
    assert.equal(res.headers['Content-Type'], 'text/html; charset=utf-8');
    assert.match(res.body, /<table/);
  } finally { globalThis.fetch = orig; }
});

test('404 page → 404', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 404 });
  try {
    const res = await main({ path: '/missing', EDS_ORIGIN_PREVIEW: 'https://eds.example' });
    assert.equal(res.statusCode, 404);
  } finally { globalThis.fetch = orig; }
});

test('send() is not implemented in Phase 1', async () => {
  await assert.rejects(() => send({ to: ['a@x'], subject: 's', html: '<p>x</p>' }), /Phase 2/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app-builder && node --test test/main.test.js`
Expected: FAIL — exports not defined.

- [ ] **Step 3: Write minimal implementation**

`send.js`:
```js
// Phase-2 seam: keep the interface stable so delivery slots in without reshaping Phase 1.
// eslint-disable-next-line no-unused-vars
export async function send({ to, subject, html } = {}) {
  throw new Error('send() is Phase 2 — not implemented');
}
```

`index.js`:
```js
import { convert } from './pipeline.js';
import { DEFAULT_ORIGINS } from './fetch.js';

function isTrue(v) {
  return v === true || v === 'true' || v === '1';
}

export async function main(params = {}) {
  const path = params.path || params.__ow_path || '';
  if (!path) {
    return { statusCode: 400, body: { error: 'missing required param: path' } };
  }

  const env = params.env === 'live' ? 'live' : 'preview';
  const origins = {
    preview: params.EDS_ORIGIN_PREVIEW || DEFAULT_ORIGINS.preview,
    live: params.EDS_ORIGIN_LIVE || DEFAULT_ORIGINS.live,
  };

  try {
    const result = await convert({
      path,
      env,
      origins,
      subject: params.subject || '',
      preheader: params.preheader || '',
    });

    if (result === null) {
      return { statusCode: 404, body: { error: 'page not found', path } };
    }

    if (isTrue(params.preview)) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: result.html,
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: {
        html: result.html,
        subject: result.subject,
        preheader: result.preheader,
        warnings: result.warnings,
        meta: { path, env, blocksRendered: result.blocksRendered },
      },
    };
  } catch (err) {
    return { statusCode: 502, body: { error: 'conversion failed', message: err.message } };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app-builder && node --test test/main.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the whole suite**

Run: `cd app-builder && npm test`
Expected: all test files pass.

- [ ] **Step 6: Commit**

```bash
git add app-builder/actions/convert-email/index.js app-builder/actions/convert-email/send.js app-builder/test/main.test.js
git commit -m "feat(email): web-action entrypoint + Phase-2 send stub"
```

---

## Manual verification (after Task 13)

Not automated — documented so a human can confirm real rendering:

1. **Local invoke:** from `app-builder/`, run a one-off Node script that imports `main` and writes `result.html` to a file (or wire `aio app run` and hit the action URL with `?path=/home&preview=true`).
2. **Eyeball:** open the produced HTML in a browser (`preview=true`).
3. **Client matrix (release gate):** send the HTML through Litmus / Email on Acid, or a real Outlook for Windows + Gmail + Apple Mail, and confirm layout, images (absolute URLs load), and CTAs. No unit test can substitute for this.

---

## Self-Review

**Spec coverage:**
- §1 project layout → Tasks 1, 5, 13 (co-located `app-builder/`, reuse `parseEds`). ✓
- §2 I/O contract (path/env/preview/subject/preheader, JSON vs HTML) → Task 13. ✓
- §3 pipeline stages → Tasks 2, 3, 10, 11, 12. ✓
- §4 block matrix v1 set (default, hero, cards, columns, callout) + omit-with-warning → Tasks 5–10. ✓ (quote/steps/table/tabs/carousel/video are spec'd as fast-follows, intentionally not in this plan.)
- §5 shell/tokens → Task 4. ✓
- §6 asset/link normalization → Task 3. ✓
- §7 error handling (404, 5xx→502, block never throws, compile warnings) → Tasks 10, 11, 12, 13. ✓
- §8 Phase-2 seam (`send.js`) → Task 13. ✓
- §Testing (per-block unit, pipeline snapshot, normalization, manual matrix) → Tasks 2–13 + Manual verification. ✓

**Placeholder scan:** No TBD/TODO; every code step has runnable code; the one conditional (Task 11 MJML-version note) gives the exact fallback markup. ✓

**Type consistency:** `fetchPlainHtml`/`resolveOrigin` (Task 2) signatures match their consumer in `convert` (Task 12); `origins = { preview, live }` shape consistent across Tasks 2, 12, 13; `renderDocument → { mjml, warnings, blocksRendered }` (Task 10) matches `convert`'s destructuring (Task 12); `compile → { html, warnings }` (Task 11) matches (Task 12); `convert → { html, subject, preheader, warnings, blocksRendered }` matches `main`'s usage (Task 13); every block renderer is `(block) → string` and is registered in `BLOCKS` (Task 10). ✓
