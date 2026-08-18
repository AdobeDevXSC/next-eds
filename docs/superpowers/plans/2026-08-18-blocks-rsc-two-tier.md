# Two-tier blocks + RSC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the six mis-ported presentation blocks render on both the raw EDS URL and the Next.js deployment by reverting them to single-source vanilla OOTB blocks, and codify a two-tier blocks/RSC convention with guardrails.

**Architecture:** Tier-1 presentation blocks are canonical vanilla `decorate(block)` + CSS: rendered natively by `aem.js` on `main--…aem.page/.live`, and client-decorated in Next via the existing `lib/eds/LegacyBlock.jsx` bridge (empty `lib/registry.js` → every block falls through to `LegacyBlock`). Tier-2 app features (auth/cart/menu/build/flags) already exist as RSC under `app/` + `lib/` and are unchanged in behavior.

**Tech Stack:** Next.js 16 App Router + React 19 (RSC), OpenNext on Cloudflare Workers, AEM Edge Delivery (EDS) client runtime (`scripts/aem.js`), ESLint (airbnb-base) + Stylelint.

**Spec:** `docs/superpowers/specs/2026-08-18-blocks-rsc-two-tier-design.md`

## Global Constraints

- **No build step on the EDS side.** Tier-1 block JS must be plain browser ES modules: `export default function decorate(block)`. **No JSX. Block JS must NOT `import` its own CSS** (browsers can't import CSS as a module; the runtime loads block CSS — `aem.js` on raw EDS, `LegacyBlock`'s dynamic `import()` in Next).
- **Reuse existing CSS unchanged.** Each vanilla `decorate` must reproduce the exact DOM its current `.jsx` emits so the existing (Stacked-themed) `<name>.css` still matches in both runtimes.
- **Decorate runs client-side in Next** (inside `LegacyBlock`'s `useEffect`) and in the browser on raw EDS — so `document`/`window` are available; no SSR-safety constraints on the decorate body.
- **No unit-test harness exists** (no `test` script). Per-task verification is `npm run lint` (ESLint + Stylelint) clean; runtime behavior is verified once at the end in both runtimes (Task 11). Use Unix (LF) line endings; keep `.js` extensions on imports.
- **Do not touch the Tier-2 app tier** (`app/api/*`, `app/(site)/{signin,order,menu,build}`, `lib/{session,db,cart,catalog,flags}.js`, `lib/order/*`). Behavior unchanged.
- Commits land on the current feature branch `claude/refactor-blocks-rsc-b9e982`. Do not push.

## File Structure

- `blocks/{hero,cards,columns,steps,callout,tabs}/<name>.js` — rewritten to vanilla `decorate`.
- `blocks/{hero,cards,columns,steps,callout,tabs}/<Name>.jsx` — deleted.
- `blocks/{header,footer}/<Name>.jsx` — deleted (orphaned); native `.js`/`.css` kept.
- `lib/registry.js` — emptied to a documented escape hatch.
- `lib/eds/render.js` — unchanged (verify only).
- `lib/eds/fragments.js` — remove `getNav`; keep `getFooter`.
- `lib/eds/nav.js` — deleted (unused).
- `app/(site)/[...slug]/page.js` — remove the unreachable `MenuHighlight` branch + now-unused imports.
- `README.md`, `AGENTS.md` — document the convention.
- `docs/architecture/blocks-and-rsc.md` — new architecture doc.
- `scripts/lint-blocks.mjs` — new guardrail; wired into `package.json` `lint`.

## Dependency waves (for parallel dispatch)

- **Wave 1 (parallel, disjoint files):** Tasks 1–6 (block conversions), Task 8 (dead-code cleanup), Task 9 (docs).
- **Wave 2 (after Wave 1):** Task 7 (empty registry — after 1–6), Task 10 (lint guardrail — after all `.jsx` removed, i.e. 1–6 + 8).
- **Wave 3:** Task 11 (dual-runtime verification).

---

### Task 1: Convert `hero` to vanilla

**Files:**
- Modify: `blocks/hero/hero.js` (replace JSX re-export shim with vanilla decorate)
- Delete: `blocks/hero/Hero.jsx`
- Keep unchanged: `blocks/hero/hero.css`

**Interfaces:**
- Produces: `blocks/hero/hero.js` default export `decorate(block)`; output DOM `<div class="hero … block"><div class="hero-content">…</div></div>` (matches removed `Hero.jsx`).

- [ ] **Step 1: Replace `blocks/hero/hero.js` with:**

```js
// Hero — portable OOTB presentation block (Tier 1). Renders natively on raw EDS and via
// LegacyBlock in Next. CSS layers the picture behind the heading/CTAs (hero.css).
export default function decorate(block) {
  const cell = block.querySelector(':scope > div > div');
  const content = document.createElement('div');
  content.className = 'hero-content';
  if (cell) content.innerHTML = cell.innerHTML;
  block.textContent = '';
  block.append(content);
}
```

- [ ] **Step 2: Delete `blocks/hero/Hero.jsx`.**
- [ ] **Step 3: Run `npm run lint` — expect clean** (no reference to `Hero.jsx` remains outside `lib/registry.js`, which Task 7 handles).
- [ ] **Step 4: Commit** `git add blocks/hero && git commit -m "refactor(hero): vanilla OOTB block for cross-runtime rendering"`

---

### Task 2: Convert `cards` to vanilla

**Files:**
- Modify: `blocks/cards/cards.js`
- Delete: `blocks/cards/Cards.jsx`
- Keep unchanged: `blocks/cards/cards.css`

**Interfaces:**
- Produces: `decorate(block)`; output `<div class="cards … block"><ul><li><div class="cards-card-image|cards-card-body">…</div>…</li>…</ul></div>` (matches `Cards.jsx`). Picture test: a cell with exactly one element child that contains a `<picture>`.

- [ ] **Step 1: Replace `blocks/cards/cards.js` with:**

```js
// Cards — portable OOTB presentation block (Tier 1). Each row → <li>; each cell classed as
// image or body. Pictures arrive pre-optimized from EDS, so there is no createOptimizedPicture.
export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    [...row.children].forEach((cell) => {
      const div = document.createElement('div');
      const pictureOnly = cell.children.length === 1 && !!cell.querySelector('picture');
      div.className = pictureOnly ? 'cards-card-image' : 'cards-card-body';
      div.innerHTML = cell.innerHTML;
      li.append(div);
    });
    ul.append(li);
  });
  block.textContent = '';
  block.append(ul);
}
```

- [ ] **Step 2: Delete `blocks/cards/Cards.jsx`.**
- [ ] **Step 3: Run `npm run lint` — expect clean.**
- [ ] **Step 4: Commit** `git add blocks/cards && git commit -m "refactor(cards): vanilla OOTB block for cross-runtime rendering"`

---

### Task 3: Convert `columns` to vanilla

**Files:**
- Modify: `blocks/columns/columns.js`
- Delete: `blocks/columns/Columns.jsx`
- Keep unchanged: `blocks/columns/columns.css`

**Interfaces:**
- Produces: `decorate(block)`; adds `columns-<N>-cols` to the block (N = first row's cell count) and `columns-img-col` to any picture-only cell (matches `Columns.jsx`). Preserves existing row/cell markup.

- [ ] **Step 1: Replace `blocks/columns/columns.js` with:**

```js
// Columns — portable OOTB presentation block (Tier 1). Adds a column-count class on the block
// and marks picture-only cells so CSS can lay out image columns.
export default function decorate(block) {
  const cols = block.querySelector(':scope > div')?.children.length ?? 0;
  block.classList.add(`columns-${cols}-cols`);
  [...block.children].forEach((row) => {
    [...row.children].forEach((cell) => {
      if (cell.children.length === 1 && cell.querySelector('picture')) {
        cell.classList.add('columns-img-col');
      }
    });
  });
}
```

- [ ] **Step 2: Delete `blocks/columns/Columns.jsx`.**
- [ ] **Step 3: Run `npm run lint` — expect clean.**
- [ ] **Step 4: Commit** `git add blocks/columns && git commit -m "refactor(columns): vanilla OOTB block for cross-runtime rendering"`

---

### Task 4: Convert `steps` to vanilla

**Files:**
- Modify: `blocks/steps/steps.js`
- Delete: `blocks/steps/Steps.jsx`
- Keep unchanged: `blocks/steps/steps.css`

**Interfaces:**
- Produces: `decorate(block)`; output `<div class="steps … block"><ol class="steps-list"><li class="steps-step"><span class="steps-num" aria-hidden="true">N</span><div class="steps-body"><div class="steps-title">…</div><div class="steps-desc">…</div></div></li>…</ol></div>` (matches `Steps.jsx`; cell[0]=title, cell[1]=description).

- [ ] **Step 1: Replace `blocks/steps/steps.js` with:**

```js
// Steps — portable OOTB presentation block (Tier 1). Renders a numbered sequence; each row is
// [title | description].
export default function decorate(block) {
  const ol = document.createElement('ol');
  ol.className = 'steps-list';
  [...block.children].forEach((row, i) => {
    const cells = row.children;
    const li = document.createElement('li');
    li.className = 'steps-step';

    const num = document.createElement('span');
    num.className = 'steps-num';
    num.setAttribute('aria-hidden', 'true');
    num.textContent = String(i + 1);

    const body = document.createElement('div');
    body.className = 'steps-body';
    const title = document.createElement('div');
    title.className = 'steps-title';
    title.innerHTML = cells[0]?.innerHTML ?? '';
    const desc = document.createElement('div');
    desc.className = 'steps-desc';
    desc.innerHTML = cells[1]?.innerHTML ?? '';
    body.append(title, desc);

    li.append(num, body);
    ol.append(li);
  });
  block.textContent = '';
  block.append(ol);
}
```

- [ ] **Step 2: Delete `blocks/steps/Steps.jsx`.**
- [ ] **Step 3: Run `npm run lint` — expect clean.**
- [ ] **Step 4: Commit** `git add blocks/steps && git commit -m "refactor(steps): vanilla OOTB block for cross-runtime rendering"`

---

### Task 5: Convert `callout` to vanilla

**Files:**
- Modify: `blocks/callout/callout.js`
- Delete: `blocks/callout/Callout.jsx`
- Keep unchanged: `blocks/callout/callout.css`

**Interfaces:**
- Produces: `decorate(block)`; output `<div class="callout … block"><span class="callout-icon" aria-hidden="true">…</span><div class="callout-body">…</div></div>` (matches `Callout.jsx`; first row, cell[0]=icon, cell[1]=body; variants tint the border via existing CSS).

- [ ] **Step 1: Replace `blocks/callout/callout.js` with:**

```js
// Callout — portable OOTB presentation block (Tier 1). One row, two cells: an icon/emoji and
// the message. Variant classes (info/warning/success) tint the border via callout.css.
export default function decorate(block) {
  const cells = block.querySelector(':scope > div')?.children ?? [];
  const icon = document.createElement('span');
  icon.className = 'callout-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = cells[0]?.innerHTML ?? '';
  const body = document.createElement('div');
  body.className = 'callout-body';
  body.innerHTML = cells[1]?.innerHTML ?? '';
  block.textContent = '';
  block.append(icon, body);
}
```

- [ ] **Step 2: Delete `blocks/callout/Callout.jsx`.**
- [ ] **Step 3: Run `npm run lint` — expect clean.**
- [ ] **Step 4: Commit** `git add blocks/callout && git commit -m "refactor(callout): vanilla OOTB block for cross-runtime rendering"`

---

### Task 6: Convert `tabs` to vanilla

**Files:**
- Modify: `blocks/tabs/tabs.js`
- Delete: `blocks/tabs/Tabs.jsx`
- Keep unchanged: `blocks/tabs/tabs.css`

**Interfaces:**
- Produces: `decorate(block)`; accessible tablist — `<div class="tabs-list" role="tablist"><button type="button" role="tab" class="tabs-tab" aria-selected>…</button>…</div>` followed by `<div role="tabpanel" class="tabs-panel" aria-hidden>…</div>` panels; cell[0]=label, cell[1]=panel; default active index 0; clicking a tab toggles `aria-selected`/`aria-hidden` (matches `Tabs.jsx`).

- [ ] **Step 1: Replace `blocks/tabs/tabs.js` with:**

```js
// Tabs — portable OOTB presentation block (Tier 1). Accessible tablist; each row is a tab
// (cell[0] = label, cell[1] = panel). This is the one Tier-1 block that is inherently
// interactive, so it decorates client-side in both runtimes.
export default function decorate(block) {
  const rows = [...block.children];
  const tablist = document.createElement('div');
  tablist.className = 'tabs-list';
  tablist.setAttribute('role', 'tablist');

  const buttons = [];
  const panels = [];

  const activate = (idx) => {
    buttons.forEach((b, j) => b.setAttribute('aria-selected', j === idx ? 'true' : 'false'));
    panels.forEach((p, j) => p.setAttribute('aria-hidden', j === idx ? 'false' : 'true'));
  };

  rows.forEach((row, i) => {
    const cells = row.children;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tabs-tab';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    btn.innerHTML = cells[0]?.innerHTML ?? '';
    btn.addEventListener('click', () => activate(i));

    const panel = document.createElement('div');
    panel.className = 'tabs-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
    panel.innerHTML = cells[1]?.innerHTML ?? '';

    buttons.push(btn);
    panels.push(panel);
    tablist.append(btn);
  });

  block.textContent = '';
  block.append(tablist, ...panels);
}
```

- [ ] **Step 2: Delete `blocks/tabs/Tabs.jsx`.**
- [ ] **Step 3: Run `npm run lint` — expect clean.**
- [ ] **Step 4: Commit** `git add blocks/tabs && git commit -m "refactor(tabs): vanilla OOTB block for cross-runtime rendering"`

---

### Task 7: Empty the block registry (escape hatch) — *after Tasks 1–6*

**Files:**
- Modify: `lib/registry.js`
- Verify unchanged: `lib/eds/render.js`

**Interfaces:**
- Consumes: nothing (removes the six imports).
- Produces: `registry` = `{}`, `resolveBlock(name)` returns `null` for every block → `render.js` routes all blocks to `LegacyBlock`.

- [ ] **Step 1: Replace `lib/registry.js` with:**

```js
// Escape hatch — intentionally EMPTY. By convention every content block is a portable vanilla
// OOTB block (blocks/<name>/<name>.js decorate() + CSS) rendered in Next via
// lib/eds/LegacyBlock.jsx, and natively by aem.js on the raw EDS URL. Add an entry here ONLY to
// opt one specific block into RSC server rendering. See docs/architecture/blocks-and-rsc.md.
export const registry = {};

export function resolveBlock(name) {
  return registry[name] || null;
}
```

- [ ] **Step 2: Confirm `lib/eds/render.js` still imports `resolveBlock` and `LegacyBlock` and is otherwise unchanged.** Run `grep -n "resolveBlock\|LegacyBlock" lib/eds/render.js`.
- [ ] **Step 3: Run `npm run lint` — expect clean.**
- [ ] **Step 4: Commit** `git add lib/registry.js && git commit -m "refactor(registry): empty registry; all content blocks render via LegacyBlock"`

---

### Task 8: Remove Next-path dead code (parallel with 1–6)

**Files:**
- Delete: `blocks/header/Header.jsx`, `blocks/footer/Footer.jsx` (orphaned). **Keep** `blocks/header/header.js`, `blocks/footer/footer.js`, and their CSS.
- Modify: `lib/eds/fragments.js` (remove `getNav`; keep `getFooter`)
- Delete: `lib/eds/nav.js`
- Modify: `app/(site)/[...slug]/page.js` (remove unreachable `MenuHighlight` branch)

- [ ] **Step 1: Verify the orphans have no importers, then delete them.**

Run: `grep -rn "Header.jsx\|Footer.jsx" app lib blocks` (expect no hits). Delete `blocks/header/Header.jsx` and `blocks/footer/Footer.jsx`.

- [ ] **Step 2: Remove `getNav` from `lib/eds/fragments.js`.**

Run `grep -rn "getNav" app lib` to confirm the only definition/usage is inside `fragments.js` itself. Open `lib/eds/fragments.js`, delete the `getNav` export/function and any now-unused imports it pulled from `./nav.js`. **Keep `getFooter`** (imported by `app/(site)/layout.js`) and everything it uses.

- [ ] **Step 3: Delete `lib/eds/nav.js`.**

Run `grep -rn "eds/nav" app lib` first — expect the only importer to be the `getNav` code you just removed. Then delete `lib/eds/nav.js`.

- [ ] **Step 4: Remove the unreachable `MenuHighlight` branch in `app/(site)/[...slug]/page.js`.**

Delete the `const highlight = path === '' ? await getMenu() : null;` line and the `{highlight && <MenuHighlight items={highlight} />}` render, then remove the now-unused `getMenu` and `MenuHighlight` imports. Leave the rest of the catch-all render (`tree.map(...)`) intact. Run `grep -n "getMenu\|MenuHighlight" app/(site)/[...slug]/page.js` — expect no hits after.

- [ ] **Step 5: Run `npm run lint` — expect clean** (no unused-import or undefined errors).
- [ ] **Step 6: Commit** `git add -A && git commit -m "chore: remove orphaned block .jsx and dead nav/highlight code"`

---

### Task 9: Document the convention (parallel with 1–6)

**Files:**
- Create: `docs/architecture/blocks-and-rsc.md`
- Modify: `README.md` (replace the stale spike/status block-conversion note)
- Modify: `AGENTS.md` (add the two-tier rule)

- [ ] **Step 1: Create `docs/architecture/blocks-and-rsc.md`** with: the two runtimes (raw EDS vs Next/OpenNext on Cloudflare), the two tiers + the deciding question, the `LegacyBlock` bridge, the empty-registry escape hatch, and "how to add a block of each type." Note that `blocks/modal` is a utility (`createModal`/`openModal`), not a renderable block. Reference the spec at `docs/superpowers/specs/2026-08-18-blocks-rsc-two-tier-design.md`.

- [ ] **Step 2: Update `README.md`.** Replace the stale "Status: spike — `hero`, `cards`, and `columns` are converted… others render as placeholders" paragraph with a short, accurate description: content blocks are portable vanilla OOTB blocks rendered via `LegacyBlock`; app features are RSC under `app/`; link to `docs/architecture/blocks-and-rsc.md`.

- [ ] **Step 3: Add a "Block tiers" section to `AGENTS.md`** stating the rule: authored presentation with no server data → Tier-1 portable vanilla block (`blocks/<name>/<name>.js` `decorate()` + CSS, no `.jsx`, no CSS import); needs server data/auth/persistence/app state → Tier-2 RSC under `app/` + `lib/`. Link to the architecture doc.

- [ ] **Step 4: Run `npm run lint` — expect clean** (Markdown isn't linted; this just confirms no accidental code changes).
- [ ] **Step 5: Commit** `git add README.md AGENTS.md docs/architecture && git commit -m "docs: two-tier blocks/RSC convention"`

---

### Task 10: Lint guardrail — no `.jsx` under `blocks/` (*after Tasks 1–6 + 8*)

**Files:**
- Create: `scripts/lint-blocks.mjs`
- Modify: `package.json` (wire into `lint`)

- [ ] **Step 1: Create `scripts/lint-blocks.mjs`:**

```js
// Guardrail: Tier-1 blocks must be portable vanilla JS. A .jsx file under blocks/ is exactly
// what broke raw-EDS rendering (browsers can't parse JSX). Fail the lint if any reappears.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'blocks';
const offenders = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (entry.endsWith('.jsx')) offenders.push(p);
  }
};
walk(root);

if (offenders.length) {
  console.error('Tier-1 blocks must be vanilla JS — remove these .jsx files:');
  offenders.forEach((f) => console.error(`  ${f}`));
  process.exit(1);
}
console.log('lint:blocks OK — no .jsx under blocks/');
```

- [ ] **Step 2: Wire it into `package.json`.** Add `"lint:blocks": "node scripts/lint-blocks.mjs"` and include it in `lint`: change `"lint": "npm run lint:js && npm run lint:css"` to `"lint": "npm run lint:js && npm run lint:css && npm run lint:blocks"`.
- [ ] **Step 3: Run `npm run lint` — expect clean** (all block `.jsx` were removed in Tasks 1–6 and 8).
- [ ] **Step 4: Sanity-check the guardrail fails when it should:** `touch blocks/hero/Tmp.jsx && npm run lint:blocks; rm blocks/hero/Tmp.jsx` — expect a non-zero exit naming `blocks/hero/Tmp.jsx`, then removal.
- [ ] **Step 5: Commit** `git add scripts/lint-blocks.mjs package.json && git commit -m "chore(lint): fail if any .jsx reappears under blocks/"`

---

### Task 11: Dual-runtime verification (*last*)

**Files:** none (verification + any parity fixes)

- [ ] **Step 1: Lint gate.** Run `npm run lint` — expect fully clean (js + css + blocks).
- [ ] **Step 2: Next path.** Start `npm run dev`; open a page that uses each converted block (author a static page under `drafts/` with all six blocks if no live page exercises them, served via `--html-folder drafts` on `aem up`, or use existing content). For each block confirm: renders visually identical to before, no console errors, and the block element ends with `data-block-status="loaded"`.
- [ ] **Step 3: Raw EDS path.** Start `npx -y @adobe/aem-cli up --no-open` (localhost:3000, classic runtime). Confirm each of the six blocks now decorates with **no** JSX/parse error in the console (this is the bug being fixed).
- [ ] **Step 4: If any block renders differently** from its pre-refactor `.jsx` output, diff the produced DOM against the per-task "Interfaces" spec and fix the `decorate` (not the CSS). Re-run Steps 2–3.
- [ ] **Step 5: Spot-check no regressions** on a native block (e.g. `accordion`) and one Tier-2 route (`/menu`).
- [ ] **Step 6: Final commit if any fixes were made** `git add -A && git commit -m "test: verify two-tier blocks render in both runtimes"`

---

## Self-Review

**Spec coverage:**
- Convert 6 ported blocks → Tasks 1–6. ✅
- Empty registry escape hatch + render.js unchanged → Task 7. ✅
- Cleanup (orphaned header/footer .jsx, getNav, nav.js, MenuHighlight branch) → Task 8. ✅
- Docs (README, AGENTS.md, architecture doc; modal note) → Task 9. ✅
- Lint guardrail → Task 10. ✅
- Dual-runtime verification → Task 11. ✅
- Keep native header/footer .js; do not touch app tier → Global Constraints + Task 8 Step 1. ✅
- Out of scope (home route, /api/revalidate security, server-side decoration) → not tasked (correct). ✅

**Placeholder scan:** every code step contains the actual code; no TBD/TODO. ✅

**Type/name consistency:** class names used in each `decorate` (`hero-content`, `cards-card-image`/`cards-card-body`, `columns-<N>-cols`/`columns-img-col`, `steps-list`/`steps-step`/`steps-num`/`steps-body`/`steps-title`/`steps-desc`, `callout-icon`/`callout-body`, `tabs-list`/`tabs-tab`/`tabs-panel`) match the removed `.jsx` and existing CSS. `resolveBlock`/`registry` names match `lib/eds/render.js`. ✅
