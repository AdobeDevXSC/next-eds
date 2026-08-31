import { LitElement, html, nothing } from '../../deps/lit/dist/index.js';
import loadStyle from '../../scripts/utils/styles.js';

const styles = await loadStyle(import.meta.url);

// The deployed convert-email App Builder action (Stage namespace). Override with ?action=<url>
// for a different deployment. See app-builder/README.md.
const ACTION_URL = new URLSearchParams(window.location.search).get('action')
  || 'https://20409-726redworm-stage.adobeioruntime.net/api/v1/web/email/convert-email';

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
// Mirrors tools/feat-flags/feat-flags.js's DA App SDK pattern: the token comes from the
// author's real DA session (never pasted/stored), with a 1.5s timeout fallback for when this
// tool isn't opened inside DA — a raw IMS token has no meaningful "manual entry" fallback the
// way feat-flags' admin key does, so outside DA this simply cannot list and says so.
async function fetchDaSources() {
  const sdk = await Promise.race([
    // eslint-disable-next-line import/no-unresolved -- remote ESM URL, not a local module
    import('https://da.live/nx/utils/sdk.js').then((mod) => mod.default),
    new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error('not in DA')), 1500);
    }),
  ]);
  const token = sdk && sdk.token;
  if (!token) throw new Error('not in DA');
  const context = (sdk && sdk.context) || {};
  const org = context.org || 'adobedevxsc';
  const repo = context.repo || 'next-eds';
  const res = await fetch(`https://admin.da.live/list/${org}/${repo}/email`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Fetches one page's converted email HTML and renders it inside its own shadow root. The
// fetched markup is a full compiled document (inline styles + a <style> block for the parts
// MJML can't inline) — writing it into a dedicated shadow tree scopes that <style> block to
// just this subtree, so the email renders isolated from (and can't bleed into) the page
// chrome around it, without the weight/sizing headaches of an <iframe>. The source is
// trusted: our own App Builder action, itself reading this site's own DA-authored content.
class EmailPreview extends LitElement {
  static properties = {
    path: {},
    content: { state: true },
    error: { state: true },
  };

  constructor() {
    super();
    this.content = '';
    this.error = '';
  }

  updated(changed) {
    if (changed.has('path')) this.load();
    if (changed.has('content') && this.content) {
      this.shadowRoot.getElementById('content').innerHTML = this.content;
    }
  }

  async load() {
    this.content = '';
    this.error = '';
    if (!this.path) return;
    try {
      const res = await fetch(`${ACTION_URL}?path=${encodeURIComponent(this.path)}&preview=true`);
      if (!res.ok) {
        this.error = `Could not load preview (HTTP ${res.status}).`;
        return;
      }
      this.content = await res.text();
    } catch {
      this.error = 'Could not load preview.';
    }
  }

  render() {
    if (this.error) {
      return html`
        <style>:host { display: block; padding: 16px; font: 14px system-ui, sans-serif; color: #b4232f; }</style>
        <p>${this.error}</p>
      `;
    }
    if (!this.content) {
      return html`
        <style>:host { display: block; padding: 16px; font: 14px system-ui, sans-serif; color: #6b6156; }</style>
        <p>Loading preview…</p>
      `;
    }
    return html`<div id="content"></div>`;
  }
}
customElements.define('email-preview', EmailPreview);

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
      <h1>Emails</h1>
      <p class="lede">Pages authored under /email, converted to email-safe HTML by the convert-email action.</p>
      <div class="layout">
        <ul class="pages">
          ${this.pages.length === 0 && !this.error
            ? html`<li class="empty">No pages found under /email.</li>`
            : nothing}
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
          ${this.selected
            ? html`<email-preview path=${this.selected}></email-preview>`
            : html`<p class="status">Select an email from the list.</p>`}
        </div>
      </div>
      <div class="msg" role="status" aria-live="polite">${this.error}</div>
    `;
  }
}

customElements.define('email-app', EmailApp);
document.body.append(document.createElement('email-app'));
