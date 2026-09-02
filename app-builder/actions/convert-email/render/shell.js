// The one place that owns the cross-cutting email frame: width, fonts, colors, preheader.
import { escapeText } from '../escape.js';

const FONT_STACK = "Helvetica, Arial, sans-serif";

export function renderShell({ body = '', preheader = '' } = {}) {
  return `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="${FONT_STACK}" />
      <mj-section padding="10px 0" />
      <mj-text font-size="16px" line-height="1.5" color="#1a1a1a" />
      <mj-button background-color="#1a1a1a" color="#ffffff" font-weight="bold" border-radius="4px" />
    </mj-attributes>
    <mj-style>
      a { color: #1a1a1a; }
      h5 { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #a8121a; font-weight: bold; margin: 16px 0 0; }
      h5 + h1, h5 + h2, h5 + h3, h5 + h4 { margin-top: 0; }
      p { margin: 0 0 12px; }

      /* Opt-in utility, not a global default (unlike the rules above it): only a template
         that adds css-class="hero-email" to its own mj-column gets this treatment, so it
         can't leak into other sites'/blocks' buttons. Overrides mj-button's inline
         background/border-radius with !important, which loses to Outlook desktop's own
         VML button fallback (unaffected by CSS) — same known limitation as every other
         mj-style rule here, acceptable for the modern/webmail/mobile clients that respect it.
         Both buttons get identical pill styling, not a primary/secondary pair: each button's
         <a> is the lone child of its own <td>, so :first-of-type/:last-of-type both match
         every one of them (verified — it silently styled both as "last"), making a
         two-tone pair unreliable in this compiled table structure. */
      .hero-email a { background: #ff7a00 !important; border-radius: 9999px !important; color: #ffffff !important; }

      /* Each button's whole row (mj-button always gets its own <tr> in the column's shared
         table — see the "both buttons get identical pill styling" comment above) is a block
         by default, stacking vertically. :has(> td > table[role="presentation"]) matches only
         those button rows — mj-image/mj-text rows put an <img>/<div> directly in their <td>,
         never a nested role="presentation" table — so this can't catch the image or heading
         above the buttons. Pulling just the button rows out of table flow into inline-block
         is what actually puts them side by side; needs :has(), unsupported in Outlook desktop
         (same acceptable-loss tier as the rest of this file). */
      .hero-email tr:has(> td > table[role="presentation"]) { display: inline-block; }
      .hero-email tr:has(> td > table[role="presentation"]) > td { padding: 10px 8px !important; }
    </mj-style>
  </mj-head>
  <mj-body width="600px" background-color="#ffffff">
    <mj-raw><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeText(preheader)}</div></mj-raw>
    ${body}
  </mj-body>
</mjml>`;
}
