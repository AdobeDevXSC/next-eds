'use client';

import Link from 'next/link';
import { useState } from 'react';
import './footer.css';

// Global site footer (design_handoff_footer 1a/1b). Content comes from the DA-authored /footer
// fragment (parsed by lib/eds/footer.js). Desktop: signup left, link columns right. Mobile:
// signup first, link groups as accordions. The email signup form is rendered but UNWIRED — no
// submit handler yet (returning to it later).
export default function SiteFooter({ model }) {
  const [openGroup, setOpenGroup] = useState(0); // mobile accordion; first group open
  if (!model) return null;
  const {
    signup, groups = [], callout, legal,
  } = model;

  return (
    <footer className="site-footer">
      <div className="footer-strip" aria-hidden="true" />
      <div className="footer-main">
        {signup && (
          <div className="footer-signup">
            <div className="footer-brand">
              <span className="brand-square" aria-hidden="true" />
              <span className="footer-brand-word">Stacked</span>
            </div>
            <h2 className="footer-headline">{signup.heading}</h2>
            <p className="footer-signup-body">{signup.body}</p>
            {/* Unwired: no submit handler yet. Real <form> markup so it progressively enhances later. */}
            <form className="footer-form" action="#" onSubmit={(e) => e.preventDefault()}>
              <label className="visually-hidden" htmlFor="footer-email">Email address</label>
              <input
                id="footer-email"
                className="footer-input"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
              />
              <button type="submit" className="btn btn-primary footer-submit">Sign up</button>
            </form>
            {signup.finePrintHtml && (
              // eslint-disable-next-line react/no-danger
              <p className="footer-fineprint" dangerouslySetInnerHTML={{ __html: signup.finePrintHtml }} />
            )}
          </div>
        )}

        {groups.length > 0 && (
          <div className="footer-columns">
            {groups.map((group, i) => {
              const isLast = i === groups.length - 1;
              const isOpen = openGroup === i;
              return (
                <div className={`footer-group${isOpen ? ' footer-group-open' : ''}`} key={group.heading}>
                  <button
                    type="button"
                    className="footer-group-head"
                    aria-expanded={isOpen}
                    aria-controls={`footer-group-${i}`}
                    onClick={() => setOpenGroup((cur) => (cur === i ? null : i))}
                  >
                    <span className="footer-group-label">{group.heading}</span>
                    <span className="footer-group-glyph" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                  </button>
                  <ul className="footer-group-links" id={`footer-group-${i}`} hidden={!isOpen}>
                    {group.links.map((link) => (
                      <li key={link.href + link.label}>
                        <Link className="footer-link" href={link.href}>{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                  {isLast && callout && (
                    <div className="footer-hours">
                      <span className="footer-hours-label">{callout.label}</span>
                      <span className="footer-hours-value">{callout.value}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {legal && (
        <div className="footer-legal">
          <span className="footer-copy">{legal.copyright}</span>
          <nav className="footer-legal-links" aria-label="Legal">
            {legal.links.map((link, i) => (
              <span className="footer-legal-item" key={link.href + link.label}>
                <Link className="footer-legal-link" href={link.href}>{link.label}</Link>
                {i < legal.links.length - 1 && <span className="footer-slash" aria-hidden="true">/</span>}
              </span>
            ))}
          </nav>
        </div>
      )}
    </footer>
  );
}
