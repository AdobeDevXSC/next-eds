// Compiles an assembled MJML document string to Outlook-safe table HTML.
import mjml2html from 'mjml';

export function compile(mjmlString) {
  const { html, errors } = mjml2html(mjmlString, {
    validationLevel: 'soft',
    minify: false,
  });
  const warnings = (errors || []).map((e) => e.formattedMessage || e.message);
  return { html, warnings };
}
