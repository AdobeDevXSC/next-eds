# EDS page → email HTML App Builder action

## Context

We want to turn a published EDS page into HTML that renders correctly in email clients
(including Outlook for Windows) and, eventually, send it. Email HTML is a different medium
from web HTML: no external CSS or `<script>`, table-based layout, inlined styles, absolute
asset/link URLs, and a hostile long tail of client quirks (the Word rendering engine behind
Outlook for Windows being the worst).

This repo is a hybrid: an EDS block collection rendered by Next.js (RSC) on Cloudflare, with
content mounted from DA (`content.da.live/AdobeDevXSC/next-eds`, see `fstab.yaml`). An "EDS
page" is available in three forms here:

1. **Delivered `.plain.html`** — the semantic sections→blocks→cells body, fetched by
   `lib/eds/fetch.js` (`fetchPlainHtml`) from `*.aem.page` (preview) / `*.aem.live` (published).
2. **Normalized tree** — `parseEds()` in `lib/eds/parse.js` turns that markup into a pure
   `section | block | default` data tree (depends only on `node-html-parser`, no Next internals).
3. **Fully-rendered Next.js page** — the decorated, interactive page.

For email we start from the **delivered `.plain.html`** and reuse the existing **`parseEds()`**
normalizer, because it already models exactly the structure an email renderer needs (blocks and
their cell grids) and is free of web-only decoration.

The deliverable is an **Adobe App Builder action** (Adobe I/O Runtime serverless function),
separate from the Next.js/Cloudflare app. No App Builder infrastructure exists in the repo yet,
so this is net-new.

Decisions locked during brainstorming:

- **Contract:** `path → email HTML` (Phase 1). Sending is Phase 2.
- **Fidelity:** block-aware — reuse `parseEds`, one dedicated email renderer per block type,
  dropped into one bulletproof shell.
- **Client targets:** broad, **including Outlook for Windows** (Word engine).
- **Engine:** MJML — its compiler generates the VML/MSO conditionals and ghost tables that make
  Outlook work, so we don't hand-maintain that fragile layer.

## Non-goals

- **No sending in Phase 1.** No ESP/SMTP integration, no recipient handling, no secrets. Phase 1
  returns HTML only. Phase 2 is designed-for (a `send()` seam) but not implemented.
- **No changes to the Next.js app** (`app/`, `lib/eds/render.js`, `lib/registry.js`, blocks). The
  action *consumes* `lib/eds/parse.js` read-only; it does not modify it. (If sharing across the
  repo boundary proves awkward at bundle time, the fallback is to copy `parse.js` into the action —
  still no change to the original.)
- **No pixel-perfect reproduction** of on-page layout. Block-aware rendering into a robust shell,
  not high-fidelity per-block visual matching.
- **No full dark-mode solution** in v1 (tracked as a hardening checklist item).
- **No authoring UI / Sidekick / DA plugin.** The action is invoked by URL; a UI is out of scope.

## Design

### 1. Project layout — App Builder app co-located in this repo

Co-locate so the action can reuse `lib/eds/parse.js` rather than duplicate the EDS-parsing
knowledge:

```
app-builder/
  app.config.yaml                  # Adobe I/O Runtime action config
  package.json                     # deps: mjml, node-html-parser (+ @adobe/aio-sdk if needed)
  .env                             # secrets (gitignored) — unused in Phase 1
  actions/
    convert-email/
      index.js                     # main(params) web-action entrypoint
      pipeline.js                  # orchestrates the stages (pure, testable)
      fetch.js                     # fetch .plain.html for a path+env
      normalize.js                 # <picture>→<img>, absolutize URLs, strip scripts/interactivity
      render/
        index.js                   # normalized tree → MJML document string
        shell.js                   # <mj-head> + body wrapper: fonts, colors, 600px width
        blocks/
          default.js               # h1–h6, p, ul/ol, img, links; a.button → mj-button
          hero.js
          cards.js
          columns.js
          callout.js
          quote.js                 # fast-follow
          steps.js                 # fast-follow
          table.js                 # fast-follow
      compile.js                   # mjml2html() wrapper; collects warnings
      send.js                      # Phase-2 STUB: sendAdapter interface only, throws NotImplemented
  test/
    fixtures/                      # sample .plain.html + expected snapshots
    *.test.js
```

**Code sharing:** `actions/convert-email` imports the repo's `../../lib/eds/parse.js` directly.
It is a pure function (only `node-html-parser`), and the `aio` build bundles it into the action.
Fallback if the cross-boundary import is awkward at deploy: copy `parse.js` into the action folder.

### 2. I/O contract

Web action. Inputs arrive merged from query string and JSON body (`params`):

| Param | Required | Default | Meaning |
|---|---|---|---|
| `path` | yes | — | EDS page path, e.g. `/menu/cubano` |
| `env` | no | `preview` | `preview` → `*.aem.page`, `live` → `*.aem.live` |
| `preview` | no | `false` | `true` → respond `Content-Type: text/html` (browser-viewable); else JSON |
| `subject` | no | — | Optional override (Phase 2 otherwise auto-sources) |
| `preheader` | no | — | Optional hidden preview-text override |

Origin default mirrors `lib/eds/fetch.js`:
`https://main--next-eds--AdobeDevXSC.aem.page` / `.aem.live`, overridable via an action default
param (`EDS_ORIGIN`).

**JSON response (default):**

```json
{
  "html": "<!doctype html>…",
  "subject": "…",
  "preheader": "…",
  "warnings": ["block 'form' omitted (not emailable)"],
  "meta": { "path": "/menu/cubano", "env": "preview", "blocksRendered": ["hero", "cards"] }
}
```

**HTML response (`preview=true`):** `{ statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: html }`.

### 3. Transform pipeline

Each stage is a pure function; `pipeline.js` composes them so the whole thing is testable without
a live network by injecting the fetched HTML.

```
fetch(path, env)            → raw .plain.html string   (fetch.js)
parseEds(html)              → normalized tree           (reused lib/eds/parse.js)
normalize(tree, origin)     → email-safe tree           (normalize.js)
renderDocument(tree)        → MJML document string       (render/index.js + render/blocks/*)
compile(mjml)               → { html, warnings }         (compile.js → mjml2html)
```

`index.js` (the entrypoint) only does param parsing, calls the pipeline, maps errors to
status codes, and shapes the response.

### 4. Block coverage matrix

| Block | Email treatment | v1? |
|---|---|---|
| default content (h1–h6, p, ul/ol, img, links) | `mj-text`; EDS `a.button` → `mj-button` | **v1** |
| hero | full-width `mj-image` + heading/text + CTA | **v1** |
| cards | `mj-section` of `mj-column`s (2-up desktop, stack mobile) | **v1** |
| columns | `mj-column`s, stack on mobile | **v1** |
| callout | background-tinted `mj-section` + CTA | **v1** |
| quote | styled `mj-text` blockquote | fast-follow |
| steps | stacked numbered `mj-section`s | fast-follow |
| table | `mj-table` | fast-follow |
| tabs / accordion | flatten — render all panels stacked | fast-follow |
| carousel | first slide (or stacked images) | fast-follow |
| video | poster `mj-image` linking to page | fast-follow |
| embed / form / search / modal / header / footer / fragment | omit, add a `warnings[]` entry (fragment inlining = Phase 2) | omit |

The **v1 set** (`default, hero, cards, columns, callout`) is exactly the content-bearing blocks
the ported registry (`lib/registry.js`) and current content actually use. Unknown/unlisted blocks
follow the omit-with-warning path — they never throw.

### 5. Email shell & design tokens (`render/shell.js`)

One place owns the cross-cutting email frame:

- `<mj-head>`: web-safe font stack aligned to the site's fonts (DM Sans / Spectral → safe
  fallbacks like Arial/Georgia), color tokens read from `styles/` values, `<mj-attributes>`
  defaults, 600px body width, mobile breakpoint.
- Hidden preheader span at the top of `<mj-body>`.
- Light-mode first. Dark-mode hardening (`color-scheme` / `supported-color-schemes` meta,
  image/logo treatment) is a documented checklist item, not fully solved in v1.

### 6. Asset & link normalization (`normalize.js`)

Email requires absolute, static assets:

- **`<picture>` → single `<img>`**: EDS delivers `<picture>` with multiple `<source>` (aem.live
  image-CDN URLs carrying `?width=` / `?format=`) plus an `<img>` fallback. Collapse to one `<img>`
  requesting an email-appropriate width via the CDN params; set `width` + `max-width:100%`.
- **Absolutize** every `src`/`srcset`/`href` against the EDS origin (extends the `./`-rewrite
  `fetchPlainHtml` already does — but for all links, not just relative image sources).
- **Strip** `<script>` and interactive attributes.
- **Entity-encode** every dynamic value (URLs, `alt`, text) at each point it is interpolated into a markup string, via a shared `escape.js` (`escapeAttr`/`escapeText`). Each pipeline stage serializes to a string and the next stage re-parses (decoding), so escaping once per serialization is balanced — it keeps output valid (e.g. a multi-param URL renders `&amp;`, not a raw `&`) without double-encoding. Without this, common EDS image URLs and UTM-tagged CTAs emit invalid markup and legacy entities in `alt` text (`Acme&reg`) get silently decoded.

### 7. Error handling

- Missing page (fetch 404) → `{ statusCode: 404, body: { error: 'page not found', path } }`.
  (`fetch.js` treats a non-page/404 like `fetchPlainHtml` does — return null, caller 404s.)
- Upstream fetch failure (5xx / network) → `{ statusCode: 502, body: { error } }`.
- **Unknown or malformed block never throws** — it is skipped and reported in `warnings[]`.
- MJML compile warnings are collected into `warnings[]`; a compile *error* (should be rare with
  generated MJML) → `{ statusCode: 500 }` with the message.
- Defensive posture: one bad block degrades gracefully; it does not fail the whole page.

### 8. Phase-2 seam (`send.js`) — designed, not built

Interface only, so Phase 2 slots in without reshaping Phase 1:

```js
// throws NotImplemented in Phase 1
export async function send({ to, subject, html }) { /* → { messageId } */ }
```

Subject/preheader sourcing (Phase 2): explicit `subject`/`preheader` params override; otherwise
page `<title>` / meta description / first `<h1>` + first paragraph. Provider (SES / SendGrid /
Resend / Mailgun / AJO / SMTP) and recipient handling are deferred; credentials will live in
Adobe I/O secrets, never in code.

## Trade-offs

- **Co-located App Builder app vs. separate repo.** Co-location lets us reuse `parse.js` and keep
  block knowledge in one place, at the cost of a second toolchain (`aio`) and deploy target in the
  repo. Chosen for DRY; a separate repo remains viable later if the action grows independently.
- **MJML dependency & compile step vs. hand-rolled tables.** MJML adds a dependency and a build
  step but removes the hand-maintained VML/MSO/ghost-table layer — the right trade given
  Outlook-for-Windows is an explicit target.
- **Reusing `parseEds` couples the action to that module's shape.** Acceptable: it's a stable,
  pure function and the coupling is read-only; the fallback (copy) fully decouples if needed.
- **query-index/metadata not used for subject in Phase 1.** Subject/preheader are Phase-2 concerns;
  Phase 1 accepts optional overrides only, avoiding an extra metadata fetch now.

## Testing

- **Per-block unit tests:** cell/tree input → expected MJML fragment, for each `render/blocks/*`.
- **Pipeline snapshot tests:** a fixture `.plain.html` (committed under `test/fixtures/`) →
  snapshot of the final compiled HTML; asserts no MJML errors and expected `warnings[]`.
- **Normalization tests:** `<picture>`→`<img>`, URL absolutization, script stripping.
- **Local run:** `aio app run` / direct `main({...})` invocation; `preview=true` to eyeball the
  HTML in a browser.
- **Manual client matrix (release checklist, not automated):** Litmus / Email on Acid — or a real
  Outlook for Windows — since no unit test can verify actual client rendering. This gate is
  documented, not coded.
