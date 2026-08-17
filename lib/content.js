import homeContent from '../content/home.json';
import builderPalette from '../content/builder-palette.json';

// Thin content/config boundary for the redesign. Keeps verbatim copy, the builder ingredient
// palette, and the fixed home illustration data out of components — so they can migrate to
// authored EDS content later without touching the UI. See
// docs/superpowers/specs/2026-08-17-stacked-redesign.md.

export function getHomeContent() {
  return homeContent;
}

export function getBuilderPalette() {
  return builderPalette.categories;
}
