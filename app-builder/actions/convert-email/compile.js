// Compiles an assembled MJML document string to Outlook-safe table HTML.
import mjml2html from 'mjml';

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
