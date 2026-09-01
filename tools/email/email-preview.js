import { LitElement, html } from '../../deps/lit/dist/index.js';

// The deployed convert-email App Builder action (Stage namespace). Override with ?action=<url>
// for a different deployment. See app-builder/README.md.
const ACTION_URL = new URLSearchParams(window.location.search).get('action')
  || 'https://20409-726redworm-stage.adobeioruntime.net/api/v1/web/email/convert-email';

// Fetches one page's converted email HTML and renders it inside its own shadow root. The
// fetched markup is a full compiled document (inline styles + a <style> block for the parts
// MJML can't inline) — writing it into a dedicated shadow tree scopes that <style> block to
// just this subtree, so the email renders isolated from (and can't bleed into) the page
// chrome around it, without the weight/sizing headaches of an <iframe>. The source is
// trusted: our own App Builder action, itself reading this site's own DA-authored content.
export default class EmailPreview extends LitElement {
  static properties = {
    path: {},
    org: {},
    repo: {},
    content: { state: true },
    error: { state: true },
  };

  constructor() {
    super();
    this.content = '';
    this.error = '';
  }

  updated(changed) {
    if (changed.has('path') || changed.has('org') || changed.has('repo')) this.load();
    if (changed.has('content') && this.content) {
      this.shadowRoot.getElementById('content').innerHTML = this.content;
    }
  }

  async load() {
    this.content = '';
    this.error = '';
    if (!this.path) return;
    try {
      // org/repo (from EmailApp's getSiteContext()) tell the action which EDS site to convert
      // from — passed through unconditionally; the action falls back to its own manifest
      // default site when both are empty, same as if this tool were never launched with a
      // site context at all.
      const params = new URLSearchParams({ path: this.path, preview: 'true' });
      if (this.org) params.set('org', this.org);
      if (this.repo) params.set('repo', this.repo);
      const res = await fetch(`${ACTION_URL}?${params}`);
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
        <style>:host { display: block; padding: 16px; font-size: 14px; color: var(--spectrum-red-1000, #b4232f); }</style>
        <p>${this.error}</p>
      `;
    }
    if (!this.content) {
      return html`
        <style>:host { display: block; padding: 16px; font-size: 14px; color: var(--spectrum-gray-600, #6b6156); }</style>
        <p>Loading preview…</p>
      `;
    }
    return html`<div id="content"></div>`;
  }
}
customElements.define('email-preview', EmailPreview);
