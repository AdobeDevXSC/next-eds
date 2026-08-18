// mjml-browser is a browser build that references `window`/`self` at module-load time.
// In Node (and the Adobe I/O Runtime action container) those globals don't exist, so
// provide minimal shims. MJML's HTML generation is pure string work — no real DOM is
// needed — so aliasing the globals to globalThis is sufficient. This module is imported
// purely for its side effect, and MUST be imported before mjml-browser so the globals
// exist by the time it evaluates (ESM evaluates imports in source order).
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis;
