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
    </mj-style>
  </mj-head>
  <mj-body width="600px" background-color="#ffffff">
    <mj-raw><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeText(preheader)}</div></mj-raw>
    ${body}
  </mj-body>
</mjml>`;
}
