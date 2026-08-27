// Tier-2 island (see lib/registry.js + components/blocks/DockCtas.jsx): needs the mobile dock
// app state that only exists in the Next app. On the raw EDS runtime there is no app, so remove
// the whole section (heading + block) rather than show an undecorated table. On Next this file is
// never loaded — the registry entry takes precedence over LegacyBlock. See
// docs/architecture/blocks-and-rsc.md.
export default function decorate(block) {
  (block.closest('.section') || block).remove();
}
