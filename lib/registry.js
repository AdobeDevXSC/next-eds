// Escape hatch — intentionally EMPTY. By convention every content block is a portable vanilla
// OOTB block (blocks/<name>/<name>.js decorate() + CSS) rendered in Next via
// lib/eds/LegacyBlock.jsx, and natively by aem.js on the raw EDS URL. Add an entry here ONLY to
// opt one specific block into RSC server rendering. See docs/architecture/blocks-and-rsc.md.
export const registry = {};

export function resolveBlock(name) {
  return registry[name] || null;
}
