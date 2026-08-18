# Blocks + RSC: the two-tier convention

This repo ships two runtimes from one source tree: the raw AEM Edge Delivery (EDS) site, and a
Next.js App Router / React Server Components (RSC) rendering of the same authored content, deployed
to Cloudflare via OpenNext. Every renderable thing in the repo is **exactly one** of two tiers — a
portable presentation block, or an RSC app feature — decided by a single question. This document
describes the convention, the bridge that lets Tier-1 blocks work in both runtimes unmodified, and
how to add new code in either tier.

Design source of truth (background, rationale, and the refactor that established this convention):
[`docs/superpowers/specs/2026-08-18-blocks-rsc-two-tier-design.md`](../superpowers/specs/2026-08-18-blocks-rsc-two-tier-design.md).

## The two runtimes

**Raw EDS** — `main--next-eds--AdobeDevXSC.aem.page` (preview) / `.aem.live` (live). AEM Code Sync
mirrors this repo to the EDS origin as-is — **no build step** on this side. `head.html` loads
`scripts/aem.js` + `scripts/scripts.js` + `styles/styles.css`; `scripts.js`'s `loadPage` decorates the
page in the browser across the three phases described in `AGENTS.md` (eager/lazy/delayed), and
`aem.js`'s `loadBlock` dynamically imports each block's `<name>.js` + `<name>.css` and calls its
`decorate(block)`.

**Next / OpenNext on Cloudflare** — a Cloudflare Worker (built with OpenNext, custom domain
`nxtjs.page`; see `DEPLOYMENT.md`) fronts EDS as a headless content origin and server-renders with
Next.js App Router + RSC. The catch-all content route, `app/(site)/[...slug]/page.js`, does:

`lib/eds/fetch.js` (fetch `.plain.html`) → `lib/eds/parse.js`'s `parseEds` (pure parse into a
section/block/default-content tree — no DOM, no mutation) → `lib/eds/render.js`'s `renderNode`
(registry hit → React component; miss → `LegacyBlock`).

Both runtimes read the same authored content and require no changes from authors in DA.

## The two tiers

Decided by one question: **does it need server data, sessions, DB/KV, or app-level state?**

| | **Tier 1 — portable presentation block** | **Tier 2 — RSC app feature** |
|---|---|---|
| **When** | Authored, presentation-only, no server data | Needs server data, auth, persistence, or app interactivity |
| **Implementation** | `blocks/<name>/<name>.js` = `export default function decorate(block) { … }` + `<name>.css`. No `.jsx`; the block JS never imports its own CSS. | React/RSC under `app/` (routes/components) + `lib/` (data access) |
| **Raw `main--…` URL** | ✅ Decorated natively by `aem.js`'s `loadBlock` | ❌ Doesn't exist there, by design |
| **Next deployment** | Markup server-rendered, then client-decorated via `LegacyBlock` | ✅ RSC render at the edge |

If the answer to the deciding question is "no," it's Tier 1. If "yes," it's Tier 2. There is no
middle tier (no dual vanilla+React "ported" block, no server-decorated block) — see "Trade-offs" in
the design spec for why.

### Tier 1 — current blocks

Every directory under `blocks/` is Tier 1 today: `hero`, `cards`, `columns`, `steps`, `callout`,
`tabs` (converted to vanilla by the refactor this doc describes), plus the already-conforming
`accordion`, `carousel`, `embed`, `form`, `fragment`, `quote`, `search`, `table`, `video`. Each is a
`<name>.js`/`<name>.css` pair with no `.jsx` and no self-import of its own CSS. `header` and `footer`
are also Tier-1 blocks (native `header.js`/`footer.js` + CSS) that decorate the raw-EDS site chrome.

**`blocks/modal` is not a renderable block.** It has no `decorate` export — it's a utility
(`createModal(contentNodes)` / `openModal(...)`) that other blocks import to build a `<dialog>` on
demand. Don't expect it to appear via `LegacyBlock` or the registry; it's invoked directly from code.

### Tier 2 — current app features

Already built, RSC under `app/` + `lib/`: auth/session/persona (`lib/session.js`, `lib/db.js`,
`app/api/auth/*`, `app/(site)/signin`), cart/order (`lib/cart.js`, `lib/order/OrderProvider.jsx`,
`app/api/cart`, `app/api/order/place`, `app/(site)/order`), menu/catalog (`lib/catalog.js`,
`lib/eds/queryIndex.js`, `app/(site)/menu`), the sandwich builder (`app/(site)/build`), feature flags
(`lib/flags.js`, `app/api/flags`), and the app shell/dock (`app/(site)/AppShell.jsx`,
`DockSlot.jsx`, `layout.js`). The home page (`/`) is also a bespoke React route rather than a block,
and stays that way (see `docs/superpowers/specs/2026-08-17-stacked-redesign.md`).

## The `LegacyBlock` bridge

`lib/eds/LegacyBlock.jsx` is what lets a single vanilla block source render in the Next/RSC runtime
without a React port. `renderNode` (in `lib/eds/render.js`) falls through to it for any block name
the registry doesn't resolve — i.e., every Tier-1 block:

1. **Server render.** The block's row/cell markup — captured verbatim by `parseEds` as `node.html` —
   is dropped into the page via `dangerouslySetInnerHTML`, wrapped as
   `<div class="<name>-wrapper"><div class="<name> <variants> block" data-block-name="<name>"
   data-block-status="initialized">…</div></div>`. The content is present and indexable even before
   any client JS runs.
2. **Client decoration (on mount, via `useEffect`).** Dynamically imports
   `../../blocks/<name>/<name>.css` (best effort) and `../../blocks/<name>/<name>.js`, sets
   `data-block-status="loading"`, calls the module's default export — `decorate(block)` — against the
   real DOM node, then sets `data-block-status="loaded"`. A ref guards against double-invoke
   (StrictMode/remount); failures are caught, logged with `console.error`, and leave the
   server-rendered markup in place rather than breaking the page.

This mirrors the same contract `aem.js`'s `loadBlock` provides natively on raw EDS — load the block's
CSS, dynamically import its JS, call `mod.default(block)`. One `decorate` function, two loaders, and
no dual-source component to keep in sync. Because the inner markup is injected as raw HTML, React
treats that subtree as opaque and never reconciles it, so `decorate`'s imperative DOM mutations are
safe.

The dynamic imports are name-keyed (`` `../../blocks/${name}/${name}.js` ``), so the bundler produces
one lazy chunk per block automatically — adding a new Tier-1 block needs no import wiring anywhere in
`lib/eds/`.

## The registry: an intentionally empty escape hatch

`lib/registry.js` exports `registry` (a block-name → component map) and `resolveBlock(name)`. By
convention **it is empty**. `renderNode` checks it first; a miss — the normal case for every block
today — falls through to `LegacyBlock`.

Add an entry here only for a deliberate, one-off decision to server-render one specific block's
content as RSC instead of the vanilla-plus-`LegacyBlock` path (for example, a block that must ship
zero client JS and has no interactivity to justify a `decorate()` step). This is uncommon: it means
that block no longer has a shared vanilla source, needs its own React render logic, and no longer
renders on the raw EDS URL. Most new blocks do not need this — prefer Tier 1.

## How to add a block (Tier 1)

1. Decide the content model first: the initial `block > div(row) > div(cell)` structure authors will
   fill in, and that your `decorate()` will read. See "Blocks" in `AGENTS.md`.
2. Create `blocks/<name>/<name>.js` exporting `default function decorate(block) { … }` using DOM APIs
   only — no JSX, no framework imports. Create `blocks/<name>/<name>.css` scoped to `.<name> …`
   selectors. Do **not** `import` the CSS from the JS: both runtimes load it for you (`aem.js`'s
   `loadBlock` on raw EDS; `LegacyBlock`'s dynamic import in Next).
3. Do **not** add anything to `lib/registry.js`. Leaving the registry miss is what routes the block
   through `LegacyBlock` automatically — no other wiring is required.
4. Verify in both runtimes (per the design spec's testing plan): the raw EDS dev server (`npx -y
   @adobe/aem-cli up …`, see "Setup Commands" in `AGENTS.md`) and the Next dev server (`npm run dev`)
   — both default to `localhost:3000`, so run them one at a time. Confirm the same DOM in both, no
   console errors, and `data-block-status="loaded"` on the Next path. Then push the branch and
   confirm on the pushed `<branch>--next-eds--AdobeDevXSC.aem.page` preview.
5. `npm run lint` (ESLint + Stylelint) before committing.

## How to add an app feature (Tier 2)

1. Confirm it actually needs server data, auth, persistence, or app-level state — if not, it's
   Tier 1, not Tier 2.
2. Add the route/UI under `app/` (Server Components by default; scope `'use client'` to the
   interactive island) and its data access under `lib/`, following the shape of the existing
   `lib/cart.js`, `lib/catalog.js`, `lib/session.js`, `lib/flags.js`.
3. This code has no raw-EDS equivalent and isn't expected to run there — it exists only in the
   Next/OpenNext deployment.
4. `npm run lint` before committing.
