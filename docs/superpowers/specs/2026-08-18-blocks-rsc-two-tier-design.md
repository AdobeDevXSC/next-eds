# Two-tier blocks + RSC convention

## Context

This repo renders AEM Edge Delivery (EDS) content through **Next.js App Router + React Server
Components**, deployed to a Cloudflare Worker via OpenNext (`nxtjs.page`); EDS remains the headless
content origin (`main--next-eds--AdobeDevXSC.aem.page`/`.aem.live`). Two runtimes are produced from
one repo, with **no build step on the EDS side** — AEM Code Sync mirrors the repo to the EDS origin
as-is.

Six blocks were "ported" from the classic vanilla-JS `decorate()` convention to React components and
registered in `lib/registry.js`: `hero`, `cards`, `columns`, `steps`, `callout`, `tabs`. Each block's
entry `blocks/<name>/<name>.js` became a bare JSX re-export shim (`import Hero from './Hero.jsx';
export default Hero;`).

**This is what broke rendering on the raw `main--…` URL.** On the EDS runtime, `aem.js`'s
`loadBlock` dynamic-imports `<name>.js` → which imports `./<name>.jsx` → the browser fetches the
`.jsx` file (served `content-type: text/jsx`) and **cannot parse JSX** → `decorate` throws → the
block degrades to undecorated markup. Confirmed: the published homepage on `.aem.page` contains
`hero`, `cards`, `steps`, and `Hero.jsx` is served as `text/jsx`. The nine blocks that were *not*
ported (`accordion`, `carousel`, `embed`, `form`, `fragment`, `quote`, `search`, `table`, `video`)
still work on raw EDS natively, and inside Next via the `LegacyBlock` client bridge.

The classic EDS client pipeline is fully intact and still wired: `scripts/aem.js`, `scripts/scripts.js`
(`loadPage`, `decorateMain`, `buildAutoBlocks`, eager/lazy/delayed), and `head.html` still loads
`aem.js` + `scripts.js` + `styles.css`. The Next render path bypasses it: `app/(site)/[...slug]/page.js`
→ `lib/eds/fetch.js` (fetch `.plain.html`) → `lib/eds/parse.js` (pure parse) → `lib/eds/render.js`
(`renderNode`; registry hit → React component, miss → `lib/eds/LegacyBlock.jsx`).

The Tier-2 app features named in the request (login, cart, menu) **already exist as RSC** under
`app/` + `lib/` (see §3). So the actual work is confined to dragging the six mis-ported blocks back
into a portable form and codifying the convention.

## Decisions (this session)

1. **Scope: establish a two-tier convention** (not just a one-off portability fix): re-sort the block
   portfolio and add guardrails so future blocks land in the right tier.
2. **Tier-1 blocks are single-source vanilla, client-decorated in Next via `LegacyBlock`** — not
   dual-source `.jsx` twins and not server-side decoration. Rationale: matches the "OOTB block"
   intent, one source of truth, least new machinery, lowest risk; the RSC *showcase* stays
   concentrated in the Tier-2 app features where it earns its keep.
3. **No `landing` block** — it was named in error; out of scope. The home page (`/`) stays a bespoke
   React route (per `docs/superpowers/specs/2026-08-17-stacked-redesign.md`), unchanged. *(Superseded
   2026-08-27: the Phase 3 home unification moved `/` back to an EDS-authored page — see
   [`blocks-and-rsc.md`](../../architecture/blocks-and-rsc.md).)*
4. **Keep `lib/registry.js` as an empty, documented escape hatch** (not removed entirely).
5. **Include the dead-code / stale-doc cleanup** surfaced by the inventory in this change.

## The convention

Every renderable thing is **exactly one** of two tiers, decided by one question: *does it need server
data, sessions, DB/KV, or app-level state?*

| | **Tier 1 — Portable presentation block** | **Tier 2 — RSC app feature** |
|---|---|---|
| **When** | Authored, presentation-only, no server data | Needs server data, auth, persistence, or app interactivity |
| **Implementation** | Canonical vanilla OOTB block: `blocks/<name>/<name>.js` = `export default function decorate(block)` + `<name>.css`. **No `.jsx`; block JS does not import its own CSS.** | React/RSC under `app/` (routes/components) + `lib/` (data) |
| **Raw `main--…` URL** | ✅ Decorated natively by `aem.js` | ❌ Does not exist there (by design) |
| **Next deployment** | Markup server-rendered, then client-decorated via `LegacyBlock` | ✅ RSC render at the edge |

### Tier membership

- **Tier 1:** `hero`, `cards`, `columns`, `steps`, `callout`, `tabs` (converted by this change) plus
  the already-conforming `accordion`, `carousel`, `embed`, `form`, `fragment`, `quote`, `search`,
  `table`, `video`. The raw-EDS site chrome `header` and `footer` (native `header.js`/`footer.js` +
  CSS) also remain vanilla and portable.
- **Tier 2 (already built; classified + documented only, no behavior change):** auth/session/persona
  (`lib/session.js`, `lib/db.js`, `app/api/auth/*`, `app/(site)/signin`), cart/order
  (`lib/cart.js`, `lib/order/OrderProvider.jsx`, `app/api/cart`, `app/api/order/place`,
  `app/(site)/order`), menu/catalog (`lib/catalog.js`, `lib/eds/queryIndex.js`, `app/(site)/menu`),
  builder (`app/(site)/build`), feature flags (`lib/flags.js`, `app/api/flags`), and the app
  shell/dock (`app/(site)/AppShell.jsx`, `DockSlot.jsx`, `layout.js`).

## Design

### 1. Convert the six ported blocks to vanilla OOTB

For each of `hero`, `cards`, `columns`, `steps`, `callout`, `tabs`:

- Replace `blocks/<name>/<name>.js` with a real `export default function decorate(block)` that
  produces the **same DOM the current `.jsx` emits**, so the existing (Stacked-themed) `<name>.css`
  is reused unchanged and output is visually identical in both runtimes.
- Delete `blocks/<name>/<Name>.jsx`.
- Remove the block's entry (and import) from `lib/registry.js`.
- The vanilla block JS **must not** `import './<name>.css'` — browsers can't import CSS as a module,
  and CSS is loaded by the runtime (aem.js `loadBlock` on raw EDS; `LegacyBlock`'s dynamic
  `import('.../<name>.css')` in Next).

Per-block target DOM (all operate on the standard `block > div(row) > div(cell)` structure both
runtimes feed to `decorate`). The picture-only test is `cell.children.length === 1 &&
cell.querySelector(':scope > picture')`:

- **hero** — move the first cell's children into a single `<div class="hero-content">`; otherwise
  CSS-only. (Matches the canonical Block Collection hero, already confirmed.)
- **cards** — rows → `<ul><li>`; each cell → `<div class="cards-card-image">` (picture-only) or
  `<div class="cards-card-body">`. (Canonical cards, minus `createOptimizedPicture` — EDS delivers
  optimized `<picture>` already.)
- **columns** — add `columns-<colCount>-cols` to the block (colCount = first row's cell count); add
  `columns-img-col` to any picture-only cell. (Canonical columns.)
- **steps** — `<ol class="steps-list">` of `<li class="steps-step">`, each with
  `<span class="steps-num" aria-hidden="true">{n}</span>` and
  `<div class="steps-body"><div class="steps-title">…</div><div class="steps-desc">…</div></div>`
  (cell[0] = title, cell[1] = description).
- **callout** — first row's two cells → `<span class="callout-icon" aria-hidden="true">…</span>` +
  `<div class="callout-body">…</div>`; variant classes tint the border.
- **tabs** — standard OOTB accessible tablist: `role="tablist"` of `<button role="tab">` (cell[0] =
  label) + `<div role="tabpanel">` (cell[1] = panel), `aria-selected`/`aria-hidden` reflecting the
  active index, click handlers switch tabs; default active = 0. This is the one Tier-1 block that is
  inherently interactive — client decoration is expected in both runtimes.

### 2. Registry + render path

- `lib/registry.js`: remove all six imports and entries so the map is **empty**; keep the file and
  `resolveBlock` with a comment documenting the convention (content blocks are vanilla and render via
  `LegacyBlock`; add an entry here only for a deliberate server-rendered content block).
- `lib/eds/render.js`: **unchanged** — with an empty registry, every block falls through to
  `LegacyBlock`.

### 3. Cleanup (in scope)

- Delete orphaned `blocks/header/Header.jsx` and `blocks/footer/Footer.jsx` (not wired anywhere; the
  app renders chrome via `app/(site)/AppShell.jsx` + `SiteFooter.jsx`). **Keep** native
  `blocks/header/header.js`, `blocks/footer/footer.js`, and their CSS — those still serve the raw EDS
  site.
- Remove Next-path dead code: `getNav` in `lib/eds/fragments.js`, `lib/eds/nav.js`
  (`parseNav`/`enrichNav`), and the unreachable `path === ''` → `MenuHighlight` branch in
  `app/(site)/[...slug]/page.js` (root is served by the exact `app/(site)/page.js`, which the required
  catch-all never matches). Verify no remaining importers before deleting.
- Fix stale `README.md` block-status section to describe the two-tier convention.
- Leave `blocks/modal` as-is (a utility exporting `createModal`/`openModal`, not a renderable block);
  note this in the docs.

### 4. Guardrails + docs (the convention deliverable)

- Add the two-tier rule + the deciding question to `AGENTS.md`.
- Add `docs/architecture/blocks-and-rsc.md`: the two runtimes, the two tiers, the `LegacyBlock`
  bridge, and "how to add a block of each type."
- Add a lightweight lint/CI guardrail that fails when a `.jsx` file exists under `blocks/` (or a
  `blocks/*/*.js` imports a `.jsx`), preventing regression into the trap that broke portability.

## Data flow (unchanged)

- **Content pages:** authored in DA → publish → `.plain.html` on `.aem.live`. Raw EDS: `aem.js`
  decorates in the browser. Next: fetch → parse → render → `LegacyBlock` (server markup + client
  decorate) → Cloudflare edge cache (`Cache-Tag: page:<slug>`) → `revalidateTag` on publish.
- **App features:** RSC under `app/` read D1/KV via `lib/`; interactivity in `'use client'` islands.

## Error handling

No new error paths. `LegacyBlock` already wraps decorate in try/catch, logs failures, and leaves the
server-rendered markup in place (graceful degradation). Raw EDS handles block-load errors via
`aem.js`. The main risk is **visual parity** — the vanilla `decorate` must reproduce the `.jsx` DOM
so the existing CSS still matches; covered by the verification plan.

## Trade-offs

- The six blocks lose the zero-client-JS RSC property in the Next deployment (they now client-decorate
  via `LegacyBlock`). Accepted: content is still server-rendered (SEO/LCP intact), the RSC showcase
  lives in the Tier-2 app features, and single-source vanilla is the point of "OOTB blocks."
- Structurally-decorated blocks (`cards`, `columns`, `steps`) can show minor CLS in Next between the
  undecorated server markup and the client-decorated result. Acceptable at this scale; if it ever
  matters, server-side decoration (running `decorate` under a server DOM) is the future path to
  reclaim zero-JS without dual sources — explicitly **not** in scope now.

## Testing / validation plan

Per converted block, in **both** runtimes:

1. **Next path** — `npm run dev`: block renders identically to today, no console errors,
   `data-block-status="loaded"` on the block element.
2. **Raw EDS path** — `npx aem up` (localhost:3000, classic runtime): the six blocks decorate with no
   JSX/parse error; then confirm on a pushed `<branch>--next-eds--AdobeDevXSC.aem.page` preview.
3. `npm run lint` (ESLint + Stylelint) clean, including the new no-`.jsx`-in-`blocks/` guardrail.
4. Spot-check that the nine native blocks and the Tier-2 app tier (signin, menu, order, build) are
   unaffected.

## Out of scope

- **Home page** stays a bespoke React route; the Tier-2 app features are unchanged in behavior.
  *(Superseded 2026-08-27 — see [`blocks-and-rsc.md`](../../architecture/blocks-and-rsc.md).)*
- **Security gap (flagged separately):** `DEPLOYMENT.md` claims `/api/revalidate` is guarded by
  `REVALIDATE_SECRET`/`x-revalidate-secret`, but `app/api/revalidate/route.js` is actually
  unauthenticated with open CORS (`*`). Real issue, unrelated to this refactor — fix in its own change.
- **Server-side decoration** of Tier-1 blocks (zero-JS-in-Next without dual sources) — a possible
  future optimization, not part of this convention.
