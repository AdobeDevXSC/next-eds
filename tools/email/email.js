import { LitElement, html, nothing } from '../../deps/lit/dist/index.js';
import loadStyle from '../../scripts/utils/styles.js';
import './email-preview.js';

const styles = await loadStyle(import.meta.url);

// query-index.json is fetched RELATIVE to wherever this tool page is itself served from — it's
// EDS-delivered static content, so in every real deployment (main, any branch preview, or live)
// this tool and the index share the same origin, meaning the fetch is same-origin regardless of
// branch. That matters because the classic EDS/aem.page origin (unlike the App Builder action)
// sends no CORS headers on this endpoint, so a *cross*-origin fetch to it is flatly rejected by
// the browser — verified locally: serving this tool from a different origin than the content and
// fetching an absolute aem.page URL fails with a CORS error, not just an empty/404 response.
// Override with ?origin=<url> only for local testing against a mismatched origin.
const originOverride = new URLSearchParams(window.location.search).get('origin');

export default class EmailApp extends LitElement {
  static properties = {
    pages: { state: true },
    selected: { state: true },
    error: { state: true },
  };

  constructor() {
    super();
    this.pages = [];
    this.selected = null;
    this.error = '';
  }

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [styles];
  }

  async firstUpdated() {
    await this.loadPages();
  }

  async loadPages() {
    try {
      const res = await fetch(originOverride ? `${originOverride}/query-index.json` : '/query-index.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await res.json();
      this.pages = (data || [])
        .filter((p) => p.path && p.path.startsWith('/email/'))
        .sort((a, b) => a.path.localeCompare(b.path));
    } catch {
      this.error = 'Could not load the email list.';
    }
  }

  render() {
    return html`
      <h1>Emails</h1>
      <p class="lede">Pages authored under /email, converted to email-safe HTML by the convert-email action.</p>
      <div class="layout">
        <ul class="pages">
          ${this.pages.length === 0 && !this.error ? html`<li class="empty">No pages found under /email.</li>` : nothing}
          ${this.pages.map((p) => html`
            <li>
              <button
                type="button"
                class=${p.path === this.selected ? 'active' : ''}
                @click=${() => { this.selected = p.path; }}
              >${p.title || p.path}</button>
            </li>
          `)}
        </ul>
        <div class="preview">
          ${this.selected ? html`<email-preview path=${this.selected}></email-preview>` : html`<p class="status">Select an email from the list.</p>`}
        </div>
      </div>
      <div class="msg" role="status" aria-live="polite">${this.error}</div>
    `;
  }
}

customElements.define('email-app', EmailApp);
document.body.append(document.createElement('email-app'));
