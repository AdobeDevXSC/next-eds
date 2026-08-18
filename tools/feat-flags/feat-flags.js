import { LitElement, html, nothing } from '../../deps/lit/dist/index.js';
import loadStyle from '../../scripts/utils/styles.js';

const styles = await loadStyle(import.meta.url);

// The flags API lives on the Stacked Worker (a different origin than this AEM-served tool), so
// calls are absolute + cross-origin (the Worker allowlists this origin for CORS; POST is
// admin-key gated). Override the API origin with ?api=<origin> for non-prod.
const API_BASE = new URLSearchParams(window.location.search).get('api') || 'https://nxtjs.page';
const KNOWN = ['loyalty'];

const MANUAL_LEDE = "Toggle production features for Stacked. Enter the admin key once; it's kept for this tab only.";
const AUTO_LEDE = 'Toggle production features for Stacked. Admin key loaded from DA.';

export default class FeatFlagsApp extends LitElement {
  static properties = {
    flags: { state: true },
    adminKey: { state: true },
    autoKey: { state: true },
    msg: { state: true },
  };

  constructor() {
    super();
    this.flags = {};
    this.adminKey = '';
    this.autoKey = false;
    this.msg = '';
  }

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [styles];
  }

  async firstUpdated() {
    await this.loadKeyFromDA();
    await this.loadFlags();
  }

  // When loaded inside DA, read the admin key from the auth-gated .da/keys sheet using the DA
  // user's token (via the DA App SDK) — so an admin never pastes it. Falls back to the manual
  // input when not in DA, when the SDK doesn't resolve (1.5s timeout), or when the read fails.
  async loadKeyFromDA() {
    try {
      const sdk = await Promise.race([
        // eslint-disable-next-line import/no-unresolved -- remote ESM URL, not a local module
        import('https://da.live/nx/utils/sdk.js').then((mod) => mod.default),
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('not in DA')), 1500);
        }),
      ]);
      const token = sdk && sdk.token;
      if (!token) return;
      const context = (sdk && sdk.context) || {};
      const org = context.org || 'adobedevxsc';
      const repo = context.repo || 'next-eds';
      const res = await fetch(`https://content.da.live/${org}/${repo}/.da/keys.json`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const sheet = await res.json();
      const rows = (sheet && sheet.data) || [];
      const row = rows.find((r) => r.key === 'FLAGS_ADMIN_KEY');
      if (row && row.value) {
        this.adminKey = row.value;
        this.autoKey = true;
      }
    } catch {
      // Manual key entry is the fallback; nothing to do here.
    }
  }

  async loadFlags() {
    try {
      const res = await fetch(`${API_BASE}/api/flags`);
      this.flags = await res.json();
    } catch {
      this.msg = 'Could not load flags.';
    }
  }

  async toggle(name, enabled) {
    this.msg = '';
    try {
      const res = await fetch(`${API_BASE}/api/flags`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.adminKey}`,
        },
        body: JSON.stringify({ name, enabled }),
      });
      if (res.status === 401) {
        this.msg = 'Wrong or missing admin key.';
        return;
      }
      this.flags = await res.json();
    } catch {
      this.msg = 'Update failed — try again.';
    }
  }

  renderFlag(name) {
    const on = this.flags[name] === true;
    return html`
      <div class="flag">
        <span>
          <span class="flag-name">${name}</span><br>
          <span class="status">${on ? 'On' : 'Off'}</span>
        </span>
        <button
          type="button"
          aria-pressed=${on}
          @click=${() => this.toggle(name, !on)}
        >${on ? 'Turn off' : 'Turn on'}</button>
      </div>
    `;
  }

  render() {
    return html`
      <h1>Feature Flags</h1>
      <p class="lede">${this.autoKey ? AUTO_LEDE : MANUAL_LEDE}</p>
      ${this.autoKey ? nothing : html`
        <input
          class="key"
          type="password"
          placeholder="Admin key"
          autocomplete="off"
          .value=${this.adminKey}
          @change=${(e) => { this.adminKey = e.target.value; }}
        />
      `}
      <div class="flags">
        ${KNOWN.map((name) => this.renderFlag(name))}
      </div>
      <div class="msg" role="status" aria-live="polite">${this.msg}</div>
    `;
  }
}

customElements.define('feat-flags-app', FeatFlagsApp);
document.body.append(document.createElement('feat-flags-app'));
