# Stacked Phase 2 — Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the build-your-own configurator — "The Stack" — a `/build` route where a visitor picks ingredients from the authored palette and watches a live running price and a literal vertical stack of ingredient bricks build up, before also closing the one real correctness gap Phase 1's final review flagged (`getIngredients()` isn't safe against a non-404 origin error yet).

**Architecture:** `/build` is an explicit Next App Router route (`app/(site)/build/page.js`, a sibling of the optional catch-all, inheriting the `(site)` layout). The page is a Server Component that fetches the authored ingredient palette via `getIngredients()` and, when it has content, hands it as a prop to `SandwichBuilder`, a `'use client'` island — the only client JS this phase adds. All selection state, price computation, and the Stack visualization live in that one component; there is still no cart or persistence (Phase 3/4), so this phase deliberately ships no "Add to cart"/"Save" button — the deliverable is a real, complete, honestly-scoped configurator that computes and displays a price, matching the same "don't build dead-end UI" discipline Phase 1 used for `MenuCard`.

**Tech Stack:** Next.js 16 App Router + RSC for the page shell, one small React Client Component for the interactive configurator (`useState`/`useMemo`, no external state library), plain CSS with custom properties. Design system: [docs/DESIGN.md](../../DESIGN.md) — this phase implements "The Stack" (DESIGN.md's Components → signature component) and the "Ingredient Brick" chip. Content schema: [docs/content-schema.md](../../content-schema.md). Parent spec: [docs/superpowers/specs/2026-08-13-stacked-demo-design.md](../specs/2026-08-13-stacked-demo-design.md) §6, §11 Phase 2.

## Global Constraints

- Ingredient validation, grouping, and pricing rules are defined in [docs/content-schema.md](../../content-schema.md): `bread` rows set the build's base price; every other type (`protein|cheese|veg|sauce|extra`) is an additive upcharge, `0` meaning included. `bread` is single-select; every other type is multi-select. An ingredient's `default: true` flag means it starts pre-selected.
- Prices arrive from `getIngredients()` already coerced to integer `priceCents` (from Phase 1) — never re-parse a dollar string in this phase; only sum/format integer cents.
- Brand tokens (from [docs/DESIGN.md](../../DESIGN.md)) govern all new UI: chip radius `var(--radius-chip)` (10px, distinct from the 20px brick radius used for cards/panels), the two-layer stack shadow `var(--shadow-brick)`, brand colors as `var(--brand-*)`/`var(--on-*)` (dark ink on every bright fill except Grape), the spacing scale `var(--space-*)`, and `var(--heading-font-family)`/`var(--body-font-family)`. No hardcoded hex colors in new CSS.
- **Lint reality (carried over from Phase 1):** `.eslintignore` excludes `app` and `lib` entirely — `npm run lint:js` does not check any file this phase touches, including the new client component. `npm run lint:css` **does** cover `app/**/*.css` (the glob was already widened in Phase 1) — keep all new CSS stylelint-clean. Write clean, Airbnb-style, accessible JSX anyway; the linter won't catch mistakes here, real verification is running the code.
- No unit-test runner exists. Verification is: `npm run lint`, a fixture-fed Node script for the pure fix in Task 1, and — because Task 2 is genuinely interactive and the real EDS origin has no `/config/ingredients` authored yet — a **temporary local fixture server** (plain Node, zero new dependencies, never committed) that lets the dev server render a realistic, non-empty palette so the click-through can actually be exercised in a browser. Full instructions are in Task 2.
- The real EDS origin still has no `/config/ingredients` authored (confirmed 404 in Phase 1; Task 6's sample content there is prepared but not yet published). Every task's code must keep degrading gracefully (empty palette, never a throw) when it isn't authored yet, and every "real origin" check should expect exactly that today.
- Unix (LF) line endings; ES6+ JS with `.js`/`.jsx` import extensions everywhere.
- Accessibility: ingredient toggle chips are real `<button>` elements with `aria-pressed`, not `<div onClick>`; keyboard-operable by default.

## File Structure

- `lib/catalog.js` — modify only. Wrap `getIngredients()`'s `fetchPlainHtml` call in a `try/catch` so a non-404 origin error also degrades to an empty palette instead of throwing.
- `app/(site)/build/page.js` — new. The explicit `/build` route: fetches the palette, shows an empty state or renders `SandwichBuilder`.
- `app/(site)/build/SandwichBuilder.jsx` — new. The interactive configurator ("The Stack"): ingredient chips, selection state, live price, and the vertical stack visualization.
- `app/(site)/build/build.css` — new. All `/build` route + builder + chip + stack styles.

---

### Task 1: Harden `getIngredients()` against non-404 origin errors

**Files:**
- Modify: `lib/catalog.js`
- Verify: a fixture-fed Node script simulating a 500 response

**Interfaces:**
- Produces: `getIngredients()` still returns `Promise<Record<'bread'|'protein'|'cheese'|'veg'|'sauce'|'extra', Ingredient[]>>` (unchanged shape), but now genuinely never throws, matching its own docstring's existing "never throws" claim (which was previously true only in the 404 case).

- [ ] **Step 1: Edit `lib/catalog.js`.** In `getIngredients()`, wrap the `fetchPlainHtml` call in a `try/catch` so any origin error (not just a 404) degrades to the empty palette. Replace:

```js
export async function getIngredients() {
  const palette = { bread: [], protein: [], cheese: [], veg: [], sauce: [], extra: [] };
  const html = await fetchPlainHtml('config/ingredients', { tags: CATALOG_TAGS });
  if (!html) return palette;
```

with:

```js
export async function getIngredients() {
  const palette = { bread: [], protein: [], cheese: [], veg: [], sauce: [], extra: [] };
  let html;
  try {
    html = await fetchPlainHtml('config/ingredients', { tags: CATALOG_TAGS });
  } catch {
    // A non-404 origin error (5xx, network) — degrade to an empty palette, same as "not
    // authored yet"; the builder must never 500 a page over a transient origin problem.
    return palette;
  }
  if (!html) return palette;
```

Leave the rest of the function (the `parseEds`/block-lookup/row-mapping logic below this point) exactly as it is.

- [ ] **Step 2: Verify the 404 case still behaves as before** (this must not regress — it's Phase 1's existing, reviewed behavior). This machine's default Node (v20.11.1) has unreliable ESM/CJS auto-detection for these files — use Node 22 (`nvm use 22`, or invoke `~/.nvm/versions/node/v22.16.0/bin/node` directly) for every script below:

```bash
~/.nvm/versions/node/v22.16.0/bin/node --input-type=module -e "
globalThis.fetch = async () => new Response(null, { status: 404 });
const { getIngredients } = await import('./lib/catalog.js');
console.log('404 case bread:', JSON.stringify((await getIngredients()).bread));
"
```

Expected: `404 case bread: []`.

- [ ] **Step 3: Verify the new 500 case degrades instead of throwing:**

```bash
~/.nvm/versions/node/v22.16.0/bin/node --input-type=module -e "
globalThis.fetch = async () => new Response('server error', { status: 500 });
const { getIngredients } = await import('./lib/catalog.js');
const palette = await getIngredients();
console.log('500 case bread:', JSON.stringify(palette.bread));
"
```

Expected: `500 case bread: []` — no thrown error, no unhandled rejection.

- [ ] **Step 4: Verify a genuinely valid response still parses correctly** (proving the try/catch didn't accidentally swallow the success path):

```bash
~/.nvm/versions/node/v22.16.0/bin/node --input-type=module -e "
globalThis.fetch = async () => new Response('<div><div class=\"ingredients\"><div><div>bread</div><div>Ciabatta</div><div>8.50</div><div>true</div></div></div></div>', { status: 200 });
const { getIngredients } = await import('./lib/catalog.js');
const palette = await getIngredients();
console.log('valid case bread:', JSON.stringify(palette.bread));
"
```

Expected: `valid case bread: [{"name":"Ciabatta","priceCents":850,"default":true}]`.

- [ ] **Step 5: Run `npm run lint`.**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 6: Commit.**

```bash
git add lib/catalog.js
git commit -m "fix(catalog): degrade to an empty palette on any ingredients-fetch error, not just 404

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: The `/build` route — "The Stack" configurator

**Files:**
- Create: `app/(site)/build/page.js`, `app/(site)/build/SandwichBuilder.jsx`, `app/(site)/build/build.css`
- Verify: `npm run lint`; curl + browser for today's real empty state; a **temporary local fixture server** (never committed) + browser click-through for the interactive, non-empty path

**Interfaces:**
- Consumes: `getIngredients()` from Task 1 (`lib/catalog.js`), returning `Record<'bread'|'protein'|'cheese'|'veg'|'sauce'|'extra', {name: string, priceCents: number, default: boolean}[]>`.
- Produces: the route `GET /build`. Produces `SandwichBuilder({ palette })` — a default-exported Client Component, only ever rendered when at least one ingredient exists somewhere in the palette (the empty-state decision is made by `page.js`, a Server Component, so an empty palette ships zero extra client JS).

- [ ] **Step 1: Write `app/(site)/build/build.css`:**

```css
/* Stacked — /build route styles: "The Stack" signature component (see docs/DESIGN.md). Brand
   tokens only. The right-hand stack is the build's signature: adding an ingredient drops a
   brick into place with the snap-settle motion (a plain CSS mount animation — no JS needed,
   since React mounts a new DOM node per added ingredient). */

.build-page h1 {
  margin-bottom: var(--space-m);
}

.build-empty {
  color: var(--text-muted);
}

.build-columns {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-l);
  align-items: start;
}

@media (width >= 900px) {
  .build-columns {
    grid-template-columns: minmax(0, 1fr) 320px;
  }
}

.build-group {
  margin-bottom: var(--space-m);
}

.build-group-label {
  margin: 0 0 var(--space-xs);
  font-size: var(--body-font-size-s);
  font-weight: var(--weight-bold);
}

.build-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.build-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--surface-card);
  border: var(--border-width) solid var(--border-hairline);
  border-radius: var(--radius-chip);
  padding: 0.5em 0.9em;
  font: inherit;
  font-size: var(--body-font-size-s);
  color: var(--text-color);
  cursor: pointer;
  transition: transform var(--duration-snap) var(--ease-snap),
              box-shadow var(--duration-snap) var(--ease-snap),
              background-color var(--duration-fast) var(--ease-standard);
}

.build-chip:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-brick);
}

.build-chip-on {
  background: var(--brand-zest);
  border-color: transparent;
  color: var(--on-zest);
  box-shadow: var(--shadow-brick);
}

.build-chip-stud {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-color);
  display: inline-block;
}

.build-stack-panel {
  background: var(--surface-card);
  border-radius: var(--radius-brick);
  box-shadow: var(--shadow-brick);
  padding: var(--space-s) var(--space-m);
}

.build-stack-title {
  margin: 0 0 var(--space-xs);
  font-family: var(--heading-font-family);
  font-size: var(--heading-font-size-m);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
}

.build-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.build-slab {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs);
  padding: 0.6em 0.9em;
  border-radius: var(--radius-input);
  font-size: var(--body-font-size-s);
  font-weight: var(--weight-medium);
  color: var(--text-color);
  background: var(--surface-tint);
  animation: build-slab-drop var(--duration-snap) var(--ease-snap);
}

.build-slab-bread { background: var(--brand-sun); color: var(--on-sun); }
.build-slab-protein { background: var(--brand-punch-soft); color: var(--text-color); }
.build-slab-cheese { background: var(--brand-sky); color: var(--on-sky); }
.build-slab-veg { background: var(--brand-zest); color: var(--on-zest); }
.build-slab-sauce { background: var(--surface-tint); color: var(--text-color); }
.build-slab-extra { background: var(--brand-grape); color: var(--on-grape); }

@keyframes build-slab-drop {
  from {
    transform: translateY(-8px);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .build-slab {
    animation: none;
  }
}

.build-total {
  display: flex;
  justify-content: space-between;
  margin-top: var(--space-xs);
  padding-top: var(--space-xs);
  border-top: var(--border-width) solid var(--border-hairline);
  font-family: var(--heading-font-family);
  font-size: var(--heading-font-size-m);
  font-weight: var(--weight-bold);
}
```

- [ ] **Step 2: Write `app/(site)/build/SandwichBuilder.jsx`:**

```jsx
'use client';

import { useMemo, useState } from 'react';
import './build.css';

const TYPE_ORDER = ['bread', 'protein', 'cheese', 'veg', 'sauce', 'extra'];
const TYPE_LABELS = {
  bread: 'Bread', protein: 'Protein', cheese: 'Cheese', veg: 'Veggies', sauce: 'Sauce', extra: 'Extras',
};

/** Bread starts on its first `default: true` item (or its first item at all); every other
 * type starts with every `default: true` item pre-selected. */
function initialSelection(palette) {
  const selected = {};
  TYPE_ORDER.forEach((type) => {
    const items = palette[type] || [];
    if (type === 'bread') {
      selected.bread = items.find((item) => item.default) || items[0] || null;
    } else {
      selected[type] = items.filter((item) => item.default).map((item) => item.name);
    }
  });
  return selected;
}

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// The build-your-own configurator ("The Stack" — see docs/DESIGN.md). Bread is single-select
// (it sets the build's base price); every other type is multi-select (each an additive
// upcharge, 0 = included). The right column renders the current selection as a literal
// vertical stack of bricks with a running total — the signature component of the brand.
export default function SandwichBuilder({ palette }) {
  const [selected, setSelected] = useState(() => initialSelection(palette));

  const selectBread = (item) => setSelected((prev) => ({ ...prev, bread: item }));

  const toggle = (type, name) => setSelected((prev) => {
    const set = new Set(prev[type]);
    if (set.has(name)) set.delete(name); else set.add(name);
    return { ...prev, [type]: [...set] };
  });

  const stack = useMemo(() => {
    const rows = [];
    if (selected.bread) {
      rows.push({ type: 'bread', name: selected.bread.name, priceCents: selected.bread.priceCents });
    }
    TYPE_ORDER.slice(1).forEach((type) => {
      (palette[type] || [])
        .filter((item) => selected[type]?.includes(item.name))
        .forEach((item) => rows.push({ type, name: item.name, priceCents: item.priceCents }));
    });
    return rows;
  }, [selected, palette]);

  const totalCents = stack.reduce((sum, row) => sum + row.priceCents, 0);

  return (
    <div className="build-columns">
      <div className="build-palette">
        {TYPE_ORDER.map((type) => {
          const items = palette[type] || [];
          if (items.length === 0) return null;
          return (
            <div className="build-group" key={type}>
              <p className="build-group-label">{TYPE_LABELS[type]}</p>
              <div className="build-chips">
                {items.map((item) => {
                  const isSelected = type === 'bread'
                    ? selected.bread?.name === item.name
                    : selected[type]?.includes(item.name);
                  return (
                    <button
                      key={item.name}
                      type="button"
                      className={`build-chip${isSelected ? ' build-chip-on' : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => (type === 'bread' ? selectBread(item) : toggle(type, item.name))}
                    >
                      {isSelected && <span className="build-chip-stud" aria-hidden="true" />}
                      {item.name}
                      {item.priceCents > 0 && ` +${formatPrice(item.priceCents)}`}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="build-stack-panel">
        <p className="build-stack-title">Your stack</p>
        <div className="build-stack">
          {stack.map((row) => (
            <div key={`${row.type}-${row.name}`} className={`build-slab build-slab-${row.type}`}>
              <span>{row.name}</span>
              <span>{row.priceCents > 0 ? formatPrice(row.priceCents) : 'incl.'}</span>
            </div>
          ))}
        </div>
        <div className="build-total">
          <span>Total</span>
          <span>{formatPrice(totalCents)}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `app/(site)/build/page.js`:**

```jsx
import { getIngredients } from '../../../lib/catalog.js';
import SandwichBuilder from './SandwichBuilder.jsx';
import './build.css';

export const metadata = {
  title: 'Build your own — Stacked',
  description: 'Stack your own sandwich from the authored ingredient palette, brick by brick.',
};

const TYPES = ['bread', 'protein', 'cheese', 'veg', 'sauce', 'extra'];

// Explicit route: /build wins over the [[...slug]] catch-all. Reads the authored ingredient
// palette directly — this is app UI, not EDS content. Ships zero client JS when the palette
// is empty (SandwichBuilder — the only client component this route can render — is never
// mounted in that case).
export default async function BuildPage() {
  const palette = await getIngredients();
  const hasIngredients = TYPES.some((type) => (palette[type] || []).length > 0);

  return (
    <main>
      <div className="section">
        <div className="build-page">
          <h1>Build your own</h1>
          {hasIngredients ? (
            <SandwichBuilder palette={palette} />
          ) : (
            <p className="build-empty">The ingredient palette isn&rsquo;t set up yet — check back soon.</p>
          )}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run `npm run lint`.**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 5: Verify today's real empty state.** Start the dev server, read its actual port from the startup log (don't assume 3000):

```bash
npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:<PORT>/build"
curl -s "http://localhost:<PORT>/build"
```

Expected: `200`, and the body contains `<h1>Build your own</h1>` and the exact text `The ingredient palette isn't set up yet — check back soon.` (curly apostrophe from `&rsquo;`), and does **not** contain `build-columns` (proving `SandwichBuilder` was not rendered — zero client JS shipped for the empty case).

- [ ] **Step 6: Stop the dev server.**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 7: Set up a temporary local fixture server so the interactive path can actually be exercised.** The real EDS origin has no `/config/ingredients` authored yet, so this is the only way to click through a real, non-empty builder before content exists. None of this is committed. Create a scratch directory and a tiny zero-dependency static server:

```bash
mkdir -p /tmp/stacked-fixture
cat > /tmp/stacked-fixture/ingredients.plain.html <<'EOF'
<div><div class="ingredients">
<div><div>bread</div><div>Ciabatta</div><div>8.50</div><div>true</div></div>
<div><div>bread</div><div>Sourdough</div><div>8.50</div><div></div></div>
<div><div>protein</div><div>Turkey</div><div>0</div><div>true</div></div>
<div><div>protein</div><div>Bacon</div><div>2</div><div></div></div>
<div><div>cheese</div><div>Provolone</div><div>1</div><div></div></div>
<div><div>veg</div><div>Lettuce</div><div>0</div><div>true</div></div>
<div><div>veg</div><div>Tomato</div><div>0</div><div>true</div></div>
<div><div>sauce</div><div>Pesto mayo</div><div>0</div><div>true</div></div>
<div><div>extra</div><div>Avocado</div><div>1.50</div><div></div></div>
</div></div>
EOF
cat > /tmp/stacked-fixture/server.mjs <<'EOF'
import http from 'node:http';
import { readFile } from 'node:fs/promises';

const PORT = 4100;
http.createServer(async (req, res) => {
  if (req.url.startsWith('/config/ingredients.plain.html')) {
    const html = await readFile(new URL('./ingredients.plain.html', import.meta.url), 'utf8');
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(html);
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(PORT, () => console.log(`fixture server on :${PORT}`));
EOF
~/.nvm/versions/node/v22.16.0/bin/node /tmp/stacked-fixture/server.mjs &
sleep 1
curl -s -o /dev/null -w "fixture check: %{http_code}\n" "http://localhost:4100/config/ingredients.plain.html"
```

Expected: `fixture check: 200`.

- [ ] **Step 8: Start the dev server pointed at the fixture** (the `EDS_ORIGIN` env var override is read once at process start by `lib/eds/fetch.js` — this only affects this one dev-server run, nothing is written to any file):

```bash
EDS_ORIGIN=http://localhost:4100 npm run dev &
sleep 3
curl -s "http://localhost:<PORT>/build" | grep -q "build-columns" && echo "builder rendered" || echo "BUILDER MISSING"
```

Expected: `builder rendered`.

- [ ] **Step 9: Browser click-through.** Using the Browser tool, open `http://localhost:<PORT>/build` and verify, in order:
  1. The palette shows six groups (Bread, Protein, Cheese, Veggies, Sauce, Extras) as chips, with Ciabatta, Turkey, Lettuce, Tomato, and Pesto mayo already selected (shown with the check-stud) — matching each fixture row's `default: true`.
  2. The stack panel shows those five items with a running Total of **$8.50** (Ciabatta's base price; every pre-selected extra in this fixture is `0`/included).
  3. Click "Bacon" (protein, +$2) — it becomes selected, a new slab drops into the stack with a brief motion, and the Total updates to **$10.50**.
  4. Click "Sourdough" (bread) — Ciabatta deselects, Sourdough becomes selected (single-select), the bread slab swaps, and the Total stays **$10.50** (both breads are $8.50).
  5. Click "Bacon" again to deselect it — its slab disappears and the Total returns to **$8.50**.
  6. No console errors at any point.

- [ ] **Step 10: Tear down the fixture — nothing from this step is committed.**

```bash
kill %1 %2 2>/dev/null || true
rm -rf /tmp/stacked-fixture
```

- [ ] **Step 11: Commit** (only the three real files from Steps 1-3 — confirm `git status` shows nothing from the fixture, since it was written under `/tmp`, not the repo):

```bash
git status --short
git add "app/(site)/build"
git commit -m "feat(build): add the /build route — SandwichBuilder ('The Stack')

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2 acceptance

- `getIngredients()` degrades to an empty palette on both a 404 and a non-404 origin error, and still parses a valid response correctly (Task 1, all three cases verified independently).
- `/build` resolves to the new explicit route and renders today's honest empty state, shipping zero client JS in that case.
- Against a realistic, non-empty palette (verified via the temporary fixture server, not committed), the builder pre-selects each type's defaults, correctly single-selects bread and multi-selects everything else, computes and displays the correct running total in every case exercised, and animates a new stack entry without a console error.
- `npm run lint` is green throughout.

## Not in this phase (next up)

- Phase 3 — Persistence & auth: D1 schema + persona seed, KV sessions, `/signin`, a middleware guard, and a KV-backed cart (which is what "Add to cart"/"Save sandwich" wiring on both `/menu` and `/build` is waiting on). See the [demo spec](../specs/2026-08-13-stacked-demo-design.md) §11.
