// Side-effect-only: each import registers a custom element (sp-theme, sp-sidenav,
// sp-sidenav-item) and/or a theme fragment (spectrum-two light color + medium scale) via
// Theme.registerThemeFragment. No named exports — nothing here is imported by name.
//
// Bundled locally (see package.json's build:spectrum) rather than loaded from a CDN: Spectrum
// Web Components share static state across files (the theme fragment registry) and across
// packages (sp-theme <-> sp-sidenav's Lit @lit/context wiring) that must resolve to the exact
// same module instance to work. Requesting each file as a separate CDN module — even via a
// resolver that rewrites bare specifiers to real URLs — risks giving shared classes disconnected
// copies depending on how that resolver handles internal package-relative imports; verified
// empirically against jsDelivr's `+esm` endpoint, which bundles/inlines each requested file
// independently (Rollup + esbuild) rather than serving shared internal files at one canonical
// URL, silently breaking cross-file registration. Bundling here with esbuild against real
// node_modules resolves the entire graph once, so every reference to a shared class is the
// same object — no per-request identity splitting is possible.
import '@spectrum-web-components/theme/sp-theme.js';
import '@spectrum-web-components/theme/spectrum-two/theme-light.js';
import '@spectrum-web-components/theme/spectrum-two/scale-medium.js';
import '@spectrum-web-components/sidenav/sp-sidenav.js';
import '@spectrum-web-components/sidenav/sp-sidenav-item.js';
