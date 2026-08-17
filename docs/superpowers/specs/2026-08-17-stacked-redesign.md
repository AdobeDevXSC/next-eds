# Stacked redesign — home (2a/3a) + builder (3b) + PWA shell

Source of truth for visuals/copy: `design_handoff_stacked_home/README.md` (in the repo root of the
main checkout). This doc records the architecture decisions and how the design maps onto the
codebase. It does not restate the README's token values — those are authoritative there.

## Approved decisions (2026-08-17)

1. **Home is a bespoke Next route**, not EDS-authored blocks. Verbatim copy + data come from a
   content/config layer; the pixel-exact layout lives in React.
2. **Global tokens are overwritten** with the new warm-ecru/orange system (Spectral + DM Sans, 4px
   grid, 0.5px hairlines). `/menu` and `/signin` (not in this handoff) inherit the new tokens; they
   get a sanity pass, not a redesign.
3. **Client-side local order store** (React Context + localStorage), matching the README's
   "no backend implied, persist locally" model. The existing server/KV cart (`lib/cart.js`) is left
   untouched and out of scope.
4. **Data-layer work shipped separately** (draft PR #39 off `fix/menu-images-and-nav-brand`); this
   redesign is a fresh branch off `main`.

## Routing

Current `/` is served by the optional catch-all `app/(site)/[[...slug]]` (EDS content). To free `/`
for the bespoke home without a route collision:

- Rename `app/(site)/[[...slug]]` → `app/(site)/[...slug]` (required catch-all — matches every path
  *except* `/`, so EDS content pages still work).
- Add `app/(site)/page.js` = bespoke home (2a/3a).
- `/build` (existing, explicit) → redesigned builder (3b).
- `/menu` (existing) → kept; restyled by global tokens; a tab target.
- `/order` (new) → order view + tab target.
- `/signin` (existing) → kept; restyled.

## Shell

`app/(site)/layout.js` renders the redesigned shell (replacing the EDS-nav header + footer):

- **`AppShell`** (client): desktop sticky header (14px orange square + wordmark, "Menu" /
  "Build your own" links, "Sign in" pill) + a 3px `#FF7A00` accent strip. On mobile, the header
  collapses and a **docked bottom bar** appears: an action row (context-dependent) + a 4-tab bar
  (Home / Menu / Build / Order, Order carries a count badge). Safe-area insets via
  `env(safe-area-inset-*)`.
- The header nav is static app chrome (per the design's minimal header), not the authored EDS nav
  fragment. `lib/eds/fragments.js` `getNav()`/`getFooter()` are no longer used by the shell.

## State

- **`OrderProvider`** (client Context, persisted to `localStorage`): `order` (`{name,unitPrice,qty}[]`),
  `pickupTime`, derived `orderCount`/`orderTotal` (tab badge + order view). Actions: `addToOrder`,
  `setQty`, `remove`, `setPickupTime`, `clear`.
- **Builder** keeps local `useState` for `bread` (single-select, default Sourdough) + `selected`
  (Set of ingredient ids). "Add to order" composes `Custom stack · <bread>` and calls `addToOrder`.
- **`route`** is derived from the pathname (drives active tab), not stored.
- **`signedIn`**: minimal for this scope (copy mentions it; no interactive gating in 2a/3a/3b).

## Content / config

Data comes from repo config JSON (loaded by thin `lib/` helpers), not hardcoded in components:

- **`content/builder-palette.json`** — the builder's categories/items with `{id, name, priceCents,
  color, default}`, using the README's 18 ingredient hexes. Deviation: ideally authored in EDS
  `/config/ingredients` with an added color field, but that page is unpublished/empty and adding a
  color column needs a DA schema change + publish (blocked on IMS auth this session). The local
  config is the unblocked equivalent and can migrate to authored content later.
- **`content/home.json`** — the fixed annotated hero stack (6 labelled rows with exact
  heights/radii/colors/prices from the README), Today's pick (Autumn Harvest Stack), the two-ways
  specimen bar specs, how-it-works steps, overline/tagline/lede/footer copy — all verbatim.
- **Menu** items still come from `getMenu()` (EDS query-index) on `/menu`.

## Fonts

Self-hosted via `next/font/google` (downloads + serves locally at build → satisfies the offline PWA
requirement without manual woff2 management): Spectral (400/600, incl. italic) → `--font-spectral`;
DM Sans (400/500/600) → `--font-dm-sans`. Mono = system stack. Roles never swap: Spectral = content,
DM Sans = chrome. Replaces the current Bricolage Grotesque + Hanken Grotesk `@font-face` setup.

## Build order (per handoff)

a. tokens + fonts → b. shell + routing → c. home 3a then 2a → d. builder 3b (interactive) → e. PWA
manifest + service worker + order persistence. Screenshot-verify each screen against
`design_handoff_stacked_home/screens/*.png`.

## Known deviations to confirm as they arise

- Builder palette sourced from local JSON (not authored EDS content) — see above.
- Some builder prices (e.g. smoked brisket) aren't given in the README; inferred to keep the one
  shown example total ($11.25 for sourdough + brisket + pickles) coherent. Noted in the config.
- The 3b mock's stack preview shows more bricks than its selected pills imply; the implementation is
  dynamically correct instead (preview/count/total all derive from actual selections).
