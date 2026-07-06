'use client';

import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import './header.css';

// Interactive header. Brand and tools come from the EDS nav fragment as HTML; the sections
// are a structured tree (see lib/eds/nav.js) so items with a submenu render a full-width
// mega-menu. The menu's left panel features the hovered/focused child's image + description
// (from query-index.json); the right side lists the child links. Desktop opens on hover/focus;
// mobile is a full-screen accordion where each child renders as a card.
export default function SiteHeader({ brand, sections = [], tools }) {
  const navRef = useRef(null);
  const closeTimer = useRef(null);
  const [openIndex, setOpenIndex] = useState(null); // which top-level menu is open
  const [activeChild, setActiveChild] = useState({}); // { [itemIndex]: childIndex } for the feature panel
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDesktop = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches;

  // Sticky-blur: transparent over the hero, solid + blurred once scrolled.
  useEffect(() => {
    const wrapper = navRef.current?.closest('.nav-wrapper');
    if (!wrapper) return undefined;
    const onScroll = () => wrapper.classList.toggle('is-scrolled', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflowY = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflowY = ''; };
  }, [mobileOpen]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);

  const openMenu = useCallback((i) => {
    clearCloseTimer();
    setOpenIndex(i);
  }, [clearCloseTimer]);

  // Delay close so the pointer can cross the gap from the trigger to the full-width panel.
  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpenIndex(null), 120);
  }, [clearCloseTimer]);

  const setChild = (i, ci) => setActiveChild((m) => (m[i] === ci ? m : { ...m, [i]: ci }));

  // Desktop: hover/focus opens. Mobile: tap toggles the accordion.
  const onTriggerEnter = (i) => { if (isDesktop()) openMenu(i); };
  const onItemLeave = () => { if (isDesktop()) scheduleClose(); };
  const onTriggerFocus = (i) => { if (isDesktop()) openMenu(i); };
  const onItemBlur = (e) => {
    if (isDesktop() && !e.currentTarget.contains(e.relatedTarget)) scheduleClose();
  };
  const onTriggerClick = (i) => { if (!isDesktop()) setOpenIndex((cur) => (cur === i ? null : i)); };

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && openIndex !== null) {
      setOpenIndex(null);
      if (typeof document !== 'undefined') document.activeElement?.blur?.();
    }
  };

  const closeEverything = () => { setOpenIndex(null); setMobileOpen(false); };

  return (
    <div className="nav-wrapper">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <nav id="nav" ref={navRef} aria-expanded={mobileOpen} onKeyDown={onKeyDown}>
        <div className="nav-hamburger">
          <button
            type="button"
            aria-controls="nav"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span className="nav-hamburger-icon" />
          </button>
        </div>

        {/* eslint-disable-next-line react/no-danger */}
        <div className="nav-brand" dangerouslySetInnerHTML={{ __html: brand }} />

        <div className="nav-sections">
          <ul className="nav-sections-list">
            {sections.map((item, i) => {
              if (!item.children?.length) {
                return (
                  <li className="nav-item" key={item.href || item.label}>
                    <a className="nav-link" href={item.href} onClick={closeEverything}>{item.label}</a>
                  </li>
                );
              }
              const ai = activeChild[i] ?? 0;
              const feat = item.children[ai] || item.children[0];
              const panelId = `mega-${i}`;
              const open = openIndex === i;
              return (
                <li
                  className="nav-item has-menu"
                  key={item.href || item.label}
                  onMouseEnter={() => onTriggerEnter(i)}
                  onMouseLeave={onItemLeave}
                  onBlur={onItemBlur}
                >
                  <button
                    type="button"
                    className="nav-trigger"
                    aria-haspopup="true"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => onTriggerClick(i)}
                    onFocus={() => onTriggerFocus(i)}
                  >
                    {item.label}
                  </button>

                  <div
                    id={panelId}
                    className={`mega${open ? ' is-open' : ''}`}
                    onMouseEnter={clearCloseTimer}
                    onMouseLeave={onItemLeave}
                  >
                    <div className="mega-inner">
                      <div className="mega-feature">
                        {feat?.image && (
                          <img className="mega-feature-img" src={feat.image} alt="" loading="lazy" />
                        )}
                        <h2 className="mega-feature-title">{feat?.title}</h2>
                        {feat?.description && <p className="mega-feature-desc">{feat.description}</p>}
                        {feat?.href && (
                          <a className="mega-feature-link" href={feat.href} onClick={closeEverything}>
                            Read more
                          </a>
                        )}
                      </div>

                      <ul className="mega-links">
                        {item.children.map((c, ci) => (
                          <li key={c.href || c.label}>
                            <a
                              className="mega-link"
                              href={c.href}
                              onMouseEnter={() => setChild(i, ci)}
                              onFocus={() => setChild(i, ci)}
                              onClick={closeEverything}
                            >
                              <span className="mega-link-label">{c.label}</span>
                              <span className="mega-link-card">
                                {c.image && (
                                  <img className="mega-link-thumb" src={c.image} alt="" loading="lazy" />
                                )}
                                {c.description && <span className="mega-link-desc">{c.description}</span>}
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* eslint-disable-next-line react/no-danger */}
        <div className="nav-tools" dangerouslySetInnerHTML={{ __html: tools }} />
      </nav>
    </div>
  );
}
