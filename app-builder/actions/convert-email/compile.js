// Compiles an assembled MJML document string to Outlook-safe table HTML.
// Use mjml-browser (the filesystem-free MJML build) rather than the default `mjml`:
// `mjml` pulls in a JS minifier that reads source files via require.resolve +
// fs.readFileSync at load, which webpack rewrites to numeric module ids passed to
// readFileSync → EBADF at action init on Adobe I/O Runtime ("Cannot initialize the
// action more than once"). mjml-browser produces identical table/VML output with no fs
// access, so it bundles cleanly. It expects browser globals at load — ./mjml-env.js
// shims them and MUST be imported first (ESM evaluates imports in source order).
import './mjml-env.js';
import mjml2html from 'mjml-browser';

export function compile(mjmlString) {
  const { html, errors } = mjml2html(mjmlString, {
    validationLevel: 'soft',
    minify: false,
  });
  // Prefer e.message: formattedMessage embeds the process's absolute cwd path (e.g.
  // "Line 1 of /Users/.../app-builder (mj-button) — ..."), and warnings[] is returned
  // verbatim in the public, unauthenticated JSON response.
  const warnings = (errors || []).map((e) => e.message || e.formattedMessage);
  return { html, warnings };
}
