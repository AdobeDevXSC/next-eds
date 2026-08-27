import builderPalette from '../content/builder-palette.json';

// Thin content/config boundary for the redesign. Keeps the builder ingredient palette out of
// components — so it can migrate to authored EDS content later without touching the UI. See
// docs/superpowers/specs/2026-08-17-stacked-redesign.md.

export function getBuilderPalette() {
  return builderPalette.categories;
}
