import { LitElement, html } from '../../deps/lit/dist/index.js';
import loadStyle from '../../scripts/utils/styles.js';
import getSiteContext from './site-context.js';
import './email-preview.js';

// Spectrum 2 (not the Stacked site's own brand CSS) styles this admin/DA tool — an internal
// utility, not customer-facing surface. Vendored locally (deps/spectrum, built via `npm run
// build:spectrum`) rather than loaded from a CDN, mirroring deps/lit's own pattern: Spectrum
// Web Components share static state across files (the theme fragment registry) and across
// packages (sp-theme <-> sp-sidenav's Lit @lit/context wiring) that must resolve to the exact
// same module instance to work, which per-file CDN requests can't reliably guarantee — verified
// empirically against two different CDN resolvers before switching to a local bundle. See
// deps/spectrum/src/index.js for the full explanation.
import '../../deps/spectrum/dist/index.js';

const styles = await loadStyle(import.meta.url);

// 'sign-up' -> 'Sign Up'. DA's list API returns filesystem metadata only (name/path/ext/
// lastModified), not authored <title> — this is a display fallback, not the real page title.
function prettifyName(name) {
  return name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Lists DA sources directly (admin.da.live/list) rather than the EDS query-index.json: DA's
// listing reflects every authored document immediately, including drafts that have never been
// previewed/published and so would never appear in an index (verified: /email/sign-up.html
// exists in DA but returns 404 on aem.page — the query-index approach would silently omit it).
// Selecting such a draft still works, in the sense that it degrades to EmailPreview's normal
// "Could not load preview (HTTP 404)" error, since the convert-email action reads from the EDS
// preview surface, not DA directly — previewing the page in DA first is what resolves that.
//
// The org/repo to list come from getSiteContext() (query params take priority — see
// site-context.js — so this tool can be launched against any DA site, not just the one
// hosting it); the auth token can only come from the DA App SDK regardless of that — a raw
// IMS token has no meaningful "manual entry" fallback the way feat-flags' admin key does, so
// outside DA this simply cannot list and says so.
async function fetchDaSources() {
  const { org, repo, token } = await getSiteContext();
  if (!token) throw new Error('not in DA');
  const res = await fetch(`https://admin.da.live/list/${org}/${repo}/email`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default class EmailApp extends LitElement {
  static properties = {
    pages: { state: true },
    selected: { state: true },
    error: { state: true },
    org: { state: true },
    repo: { state: true },
  };

  constructor() {
    super();
    this.pages = [];
    this.selected = null;
    this.error = '';
    this.org = '';
    this.repo = '';
  }

  connectedCallback() {
    super.connectedCallback();
    this.shadowRoot.adoptedStyleSheets = [styles];
  }

  async firstUpdated() {
    // getSiteContext() caches its result, so this and fetchDaSources()'s own call below
    // resolve the DA SDK/query-param lookup only once.
    ({ org: this.org, repo: this.repo } = await getSiteContext());
    await this.loadPages();
  }

  async loadPages() {
    try {
      const items = await fetchDaSources();
      this.pages = (items || [])
        .filter((item) => item.ext === 'html')
        .map((item) => ({ path: `/email/${item.name}`, title: prettifyName(item.name) }))
        .sort((a, b) => a.path.localeCompare(b.path));
    } catch (err) {
      this.error = err.message === 'not in DA'
        ? 'Open this tool from within DA to list emails.'
        : 'Could not load the email list.';
    }
  }

  render() {
    return html`
      <sp-theme system="spectrum-two" color="light" scale="medium">
        <div class="header">
          <h1>Emails</h1>
          <!-- Placeholder only — not wired up to any ESP yet. -->
          <button type="button" class="send-to-esp" disabled title="Not yet implemented">Send to ESP</button>
        </div>
        <p class="lede">Pages authored under /email, converted to email-safe HTML by the convert-email action.</p>
        <div class="layout">
          ${this.pages.length === 0 && !this.error
    ? html`<p class="empty">No pages found under /email.</p>`
    : html`
              <sp-sidenav @change=${(e) => { this.selected = e.target.value; }}>
                ${this.pages.map((p) => html`
                  <sp-sidenav-item value=${p.path} label=${p.title || p.path} ?selected=${p.path === this.selected}></sp-sidenav-item>
                `)}
              </sp-sidenav>
            `}
          <div class="preview">
            ${this.selected ? html`<email-preview path=${this.selected} org=${this.org} repo=${this.repo}></email-preview>` : html`<p class="status">Select an email from the list.</p>`}
          </div>
        </div>
        <div class="msg" role="status" aria-live="polite">${this.error}</div>
      </sp-theme>
    `;
  }
}

customElements.define('email-app', EmailApp);
document.body.append(document.createElement('email-app'));
