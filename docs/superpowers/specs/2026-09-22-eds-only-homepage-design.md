# EDS-only homepage equivalent (`/index-eds`)

## Goal

Publish `/index-eds` — a page that looks like the site homepage (`/`) but renders **fully on the
raw EDS surface** (`main--next-eds--AdobeDevXSC.aem.page` / `.aem.live`), using only Tier-1
portable blocks. No dependency on the Next/RSC runtime or app state.

## Background

The homepage (`/`) is a single EDS-authored page composed of Tier-1 blocks plus **two Tier-2
islands** registered in `lib/registry.js`:

- `todays-pick` — its "Add to order" button needs the cart (`useOrder()`).
- `dock-ctas` — needs the mobile dock slot (`useDockSlot()`).

On raw EDS neither island exists: each block's `blocks/<name>/<name>.js` is a vanilla **shim** that
removes its own section (`(block.closest('.section') || block).remove()`). So on the pure-EDS
surface the homepage silently loses "Today's picks" and the dock CTAs.

The user authored `/index-eds` in DA as a **verbatim copy of the homepage** (confirmed via the DA
source API). It currently 404s on `.aem.page` because it was never previewed. Its blocks:

| Block | Raw EDS today | Action in this design |
|---|---|---|
| `hero-stack` | ✅ renders (incl. inline CTAs) | keep as-is |
| `.lede` section | ✅ global styling | keep as-is |
| `two-ways` | ✅ Tier-1 | keep as-is |
| `how-it-works` | ✅ Tier-1 | keep as-is |
| `todays-pick` | ❌ shim deletes section | replace with new `todays-special` block |
| `dock-ctas` | ❌ shim deletes section | replace with default-content button pair |

All design tokens (`--surface`, `--brick-color`, `--radius-card`, `--font-chrome`, `--dot-grid`,
etc.) and the `home-section` / `lede` section styles are defined globally in `styles/`, so a static
block can reuse them for pixel parity.

## Design

### 1. New Tier-1 block: `todays-special`

A static twin of `todays-pick`. Same card visual as the homepage's "Today's picks" card, but the
cart button becomes a plain link styled as a button.

- `blocks/todays-special/todays-special.js` — `export default function decorate(block)` (DOM APIs
  only; does not import its own CSS).
- `blocks/todays-special/todays-special.css` — ported from `components/blocks/todays-pick.css`,
  with inner classes kept as `.pick-*` but scoped under `.todays-special`. Mobile-first; desktop at
  `>= 640px` (matches the homepage card, `two-ways`, and `how-it-works`).

**Content model** — ONE row, 5 cells, all plain text except the last:

```
[ badge, name, price, description, cta ]
```

- `badge` → `.pick-badge` (e.g. "Special")
- `name` → `.pick-name`
- `price` → `.pick-price`
- `description` → `.pick-desc`
- `cta` → a link rendered as a button (`.pick-add` / `.button`). Authored as a real link
  (`<a href>`), with a plain-text-path fallback (mirror `blocks/two-ways`'s `readHref`). Default
  target `/menu`.

**Baked decoration** (not authored — same pattern as `TodaysPick.jsx` / `hero-stack` /
`two-ways`): the five brick colors `['#E7C288','#D9A273','#F2C14E','#B98A3C','#E7C288']` rendered as
`.pick-stack` > 5 × `.pick-brick` with inline `--brick-color`, inside a `.pick-well` with the badge.

**Graceful degradation:** handle missing cells (author omits price/cta) without throwing, per
AGENTS.md — render only the parts present.

Because `todays-special` is not in `lib/registry.js`, it routes through `LegacyBlock` on Next and
native `loadBlock` on raw EDS — identical render on both surfaces, no shim, no registry entry.

### 2. Bottom CTAs → default-content button pair

Replace the `dock-ctas` block with two ordinary links authored as default content (a paragraph with
two links), which EDS auto-decorates into a primary + secondary button pair. Centered "closing CTA"
at the end of the page, visible on desktop and mobile. No new JS/CSS beyond existing global button
styles (add a small centering rule only if needed, scoped appropriately). Links: `Shop the menu` →
`/menu`, `Build your own` → `/build`.

### 3. DA content update + preview

Update the `/index-eds` source in DA (`admin.da.live/source/AdobeDevXSC/next-eds/index-eds.html`)
so it matches the new structure:

- `todays-pick` table → `todays-special` table, last cell authored as a link to `/menu`.
- `dock-ctas` block → default-content paragraph with the two CTA links.
- Keep `hero-stack`, `lede`, `two-ways`, `how-it-works` and their section metadata unchanged.

Then trigger an authed **preview** via `admin.hlx.page/preview/AdobeDevXSC/next-eds/main/index-eds`
so `https://main--next-eds--AdobeDevXSC.aem.page/index-eds` renders. (Publish is left to the human /
a later step.)

### 4. Local draft for verification

Add `drafts/index-eds.html` mirroring the final authored structure so the page can be verified
locally with `npx -y @adobe/aem-cli up --html-folder drafts` against the local block code,
independent of DA.

## Verification

- Local raw EDS (`aem up --html-folder drafts`): `/index-eds` shows hero, lede, two-ways, today's
  special card (matching the homepage card), how-it-works, and the closing button pair — no missing
  sections, no console errors, `data-block-status="loaded"` on `todays-special`.
- Compare the `todays-special` card side-by-side with the homepage `todays-pick` card for visual
  parity (dot-grid well, badge, brick stack, name/price/description, button).
- Next surface (optional sanity): `/index-eds` renders the same via `LegacyBlock`.
- Pushed preview: `https://<branch>--next-eds--AdobeDevXSC.aem.page/index-eds` after DA preview.
- `npm run lint` (ESLint + Stylelint) clean.

## Out of scope

- No changes to the real homepage (`/`) or the `todays-pick` / `dock-ctas` islands or their shims.
- No sticky/JS mobile dock reconstruction — the bottom CTAs are static buttons by decision.
- No cart/order behavior on `/index-eds`.
