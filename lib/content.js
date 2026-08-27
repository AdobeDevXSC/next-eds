import homeContent from '../content/home.json';

// Thin content/config boundary for the redesign. Keeps verbatim copy and the fixed home
// illustration data out of components — so they can migrate to authored EDS content later
// without touching the UI. See docs/superpowers/specs/2026-08-17-stacked-redesign.md. (The
// builder ingredient palette that used to live here moved to lib/catalog.js's
// getBuilderPalette(), sourced from the authored /config/ingredients block.)

export function getHomeContent() {
  return homeContent;
}
