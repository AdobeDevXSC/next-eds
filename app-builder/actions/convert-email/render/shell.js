// The one place that owns the cross-cutting email frame: width, fonts, colors, preheader —
// plus, for a site that hosts one, that site's own theme overrides (see fetchSiteTheme).
import { escapeText } from '../escape.js';

const FONT_STACK = "Helvetica, Arial, sans-serif";

// A site can optionally host its own global theme at the repo root (email-theme.css) —
// fetched fresh on every conversion, same pattern as a block's own .email.mjml template
// (see dynamic-block.js's fetchBlockTemplate). It's plain CSS, injected into mj-head as a
// second <mj-style> block *after* this file's own rules, so same-specificity !important
// rules there win by cascade order — a site overrides the generic defaults, it doesn't fight
// them. Returns '' (not null) when the site has no theme, so callers can always safely
// interpolate the result with no null-check — same "no template → generic fallback, not an
// error" philosophy as fetchBlockTemplate.
export async function fetchSiteTheme(origin) {
  const res = await fetch(`${origin}/email-theme.css`);
  if (res.status === 404) return '';
  if (!res.ok) throw new Error(`theme fetch failed: HTTP ${res.status} for email-theme.css`);
  return res.text();
}

export function renderShell({ body = '', preheader = '', theme = '' } = {}) {
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
    ${theme ? `<mj-style>${theme}</mj-style>` : ''}
  </mj-head>
  <mj-body css-class="email-body" width="600px" background-color="#ffffff">
    <mj-raw><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeText(preheader)}</div></mj-raw>
    <mj-wrapper css-class="email-card" padding="0">
      ${body}
    </mj-wrapper>
  </mj-body>
</mjml>`;
}
