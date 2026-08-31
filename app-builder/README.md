# EDS page → email HTML (Adobe App Builder action)

An [Adobe App Builder](https://developer.adobe.com/app-builder/) / I/O Runtime web action that converts an
Edge Delivery Services (EDS) page into email-client-safe HTML.

**Phase 1 (this action) generates HTML only.** Sending (ESP/SMTP + recipients) is a designed-for Phase 2:
`actions/convert-email/send.js` defines the seam but throws `NotImplemented`.

## How it works

```
fetch <path>.plain.html
  → parseEds        (reused read-only from ../lib/eds/parse.js)
  → normalize       (<picture>→absolute <img>, absolutize URLs, strip <script>/on* handlers, entity-encode)
  → per-block MJML  (site-hosted template if one exists, else generic content-flattening; see below)
  → mjml2html       (bulletproof, Outlook-safe tables + VML/MSO)
```

The action carries **no per-block knowledge of its own**. For each block it finds, it fetches
`<site-origin>/blocks/<name>/<name>.email.mjml` — the same fetch pattern already used for
`.plain.html` — and fills that template with the block's content. A block with no such file
still isn't dropped: its cells flatten into a plain content section (headings/text/images/links
render; the special layout a template would give does not). Only a short, fixed deny-list of
genuinely non-content blocks (`form`, `search`, `modal`, `embed` — interactive, no static
representation makes sense) is omitted outright, reported in `warnings[]`. Nothing here throws
on an unfamiliar block — that's the point: **this action is generic and site-agnostic.** Point it
at any EDS site and it works immediately; a site adds bespoke email layouts by adding files next
to its own blocks, never by touching or redeploying this action. See "Adding email support for a
block" below.

## Local development

Node 20+. This is a self-contained ESM package (its own `node_modules`, outside the repo's root ESLint globs).

```bash
cd app-builder
npm install
```

Run the tests (built-in `node:test`):

```bash
npm test
```

Preview the email HTML for any EDS page locally — writes `dist/<slug>.html` (gitignored) and prints the
blocks rendered + warnings. Open the file in a browser (images load from the EDS origin):

```bash
npm run preview -- /email/welcome
```

Pass `live` as a second arg to source from `*.aem.live` instead of the default `*.aem.page` preview:

```bash
npm run preview -- /menu/italian-stack live
```

> The `test`/`preview` scripts pass `--experimental-detect-module` so bare Node can import the ESM
> `../lib/eds/parse.js` (which lives under the repo's CommonJS root). This flag is **local-only** — the
> deployed action is a single webpack CJS bundle, so it doesn't need the flag.

## Adding email support for a block

Drop a `<name>.email.mjml` file next to a block's existing `.js`/`.css`, e.g.
`blocks/hero/hero.email.mjml`. It's fetched fresh on every conversion — no action redeploy, ever
— and it's what this repo's own `hero`/`cards`/`columns`/`callout` blocks use (read them for real
examples). No file → the block still renders, just generically (see "How it works" above); the
template is what upgrades that to a bespoke layout.

**Data available to the template**, derived from the block's own cells (each cell's raw HTML is
already run through the same content→MJML conversion a plain content section uses — a template
never sees raw author HTML, only already-safe `<mj-text>`/`<mj-image>`/`<mj-button>` fragments):

| Field | Shape | Use for |
| --- | --- | --- |
| `rows` | `Fragment[][]` — one fragment per cell, grid-shaped like the block's own rows/cells | A row is a set of side-by-side columns (`columns`: `{{#each rows.0}}`) |
| `rowFragments` | `Fragment[]` — one fragment per row, that row's cells pre-joined | A row is one repeating unit, e.g. a card (`cards`: `{{#eachChunk rowFragments 2}}`) |
| `name`, `variants` | strings | The block's own name / authored variant classes |

**Template syntax** (a small mustache-like engine — substitution and iteration only, deliberately
no conditionals and no code execution, so a template is never something the action has to treat
as untrusted code):

- `{{{path}}}` — insert raw (for the already-safe fragments above)
- `{{path}}` — insert HTML-entity-escaped (for plain strings like `name`)
- `{{#each path}}...{{/each}}` — iterate an array; `{{{this}}}`/`{{this}}` is the current item
- `{{#eachChunk path size}}...{{/eachChunk}}` — group an array into fixed-size chunks; `this`
  inside is the current chunk (an array — iterate it with a nested `{{#each this}}`)

```html
<!-- blocks/hero/hero.email.mjml — one cell, full-bleed -->
<mj-section padding="0"><mj-column>{{{rows.0.0}}}</mj-column></mj-section>

<!-- blocks/columns/columns.email.mjml — each cell in row 0 is its own column -->
<mj-section>{{#each rows.0}}<mj-column>{{{this}}}</mj-column>{{/each}}</mj-section>

<!-- blocks/cards/cards.email.mjml — each row is one card; group 2 per section -->
{{#eachChunk rowFragments 2}}<mj-section>{{#each this}}<mj-column>{{{this}}}</mj-column>{{/each}}</mj-section>{{/eachChunk}}
```

## Deploy to Adobe App Builder

### 1. Prerequisite — an App Builder project

In the [Adobe Developer Console](https://developer.adobe.com/console), create a project and add the
**App Builder** template. This provisions an **I/O Runtime** namespace and a workspace (e.g. Stage /
Production). Requires your organization's App Builder entitlement. The `aio` CLI is the only tooling
(`npm install -g @adobe/aio-cli`).

### 2. One-time: authenticate and bind the workspace

```bash
aio login
```

From this directory, bind the app to your Console workspace. This writes `.aio` and a **gitignored**
`.env` containing your Runtime namespace + auth (credentials are never committed):

```bash
cd app-builder && aio app use
```

(Alternatively, download the workspace's `console.json` from the Console and run `aio app use console.json`.)

### 3. Deploy

```bash
cd app-builder && aio app deploy
```

This builds the action (webpack bundles `actions/convert-email` **and** the reused `../lib/eds/parse.js`
into a single ~4.5 MB artifact — well under Runtime's ~48 MB limit) and deploys the `convert-email` web
action in the `email` package. Remove it with `aio app undeploy`.

Optionally, run the action on a local Runtime emulator before deploying (after step 2):

```bash
cd app-builder && aio app dev
```

### 4. Invoke

Print the deployed URL:

```bash
aio runtime action get email/convert-email --url
```

It looks like `https://<namespace>.adobeioruntime.net/api/v1/web/email/convert-email`. Then:

```bash
curl "https://<namespace>.adobeioruntime.net/api/v1/web/email/convert-email?path=/email/welcome&preview=true"
```

## HTTP API

`main(params)` — inputs arrive merged from the query string and JSON body.

| Param       | Required | Default   | Meaning                                                        |
| ----------- | -------- | --------- | -------------------------------------------------------------- |
| `path`      | yes      | —         | EDS page path, e.g. `/email/welcome`                           |
| `env`       | no       | `preview` | `preview` → `*.aem.page`, `live` → `*.aem.live`                |
| `preview`   | no       | `false`   | `true` → responds `text/html`; otherwise JSON                  |
| `subject`   | no       | `""`      | Pass-through (Phase 2 will auto-source)                        |
| `preheader` | no       | `""`      | Hidden preview text (entity-encoded into the email)            |

**JSON response** (default):

```json
{
  "html": "<!doctype html>…",
  "subject": "",
  "preheader": "",
  "warnings": ["block 'steps' omitted (not emailable)"],
  "meta": { "path": "/email/welcome", "env": "preview", "blocksRendered": ["hero", "cards"] }
}
```

**Status codes:** `200` OK · `400` missing `path` · `404` page not found · `502` upstream fetch/convert error.

## Notes & gotchas

- **Public by design.** `app.config.yaml` sets `require-adobe-auth: false`, so anyone with the URL can call
  the action. To require an Adobe IMS token, set it to `true`. `final: true` prevents the `EDS_ORIGIN_*`
  inputs from being overridden by caller query params (an SSRF mitigation).
- **Origins** default to `main--next-eds--AdobeDevXSC.aem.{page,live}` (set as manifest `inputs` in
  `app.config.yaml`); change them there for a different site/branch.
- **Unrelated CLI noise:** some `aio` commands print `ERR_REQUIRE_ESM` warnings from the
  `@adobe/aio-cli-plugin-aem-edge-functions` plugin. Harmless here; remove it with
  `aio plugins uninstall @adobe/aio-cli-plugin-aem-edge-functions` to quiet it.
- **Client rendering is the real gate.** Unit tests can't verify actual email clients — validate the output
  against a Litmus / Email on Acid matrix (or a real Outlook for Windows) before a production send.

## Roadmap

- **Phase 2 — sending:** implement the `send()` seam (ESP/SMTP adapter, recipients, subject/preheader sourcing).
- **More block templates:** this is now a site-side task (see "Adding email support for a block") — e.g.
  emailable `menu-item`, `quote`, `steps`, `table`, `tabs`, `carousel`, `video` for *this* repo's own blocks.
- **Hardening:** source `EDS_ORIGIN_*` from env (SSRF defense-in-depth), dedupe `blocksRendered`, generic
  502 message, multi-row `columns`, inline-prose `<img>` normalization.

See `docs/superpowers/specs/2026-08-18-eds-to-email-action-design.md` and
`docs/superpowers/plans/2026-08-18-eds-to-email-action.md` for the design and implementation plan.
