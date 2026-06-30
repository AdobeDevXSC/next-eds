'use client';

import { useEffect, useRef } from 'react';
import './header.css';

// Interactive header — the first 'use client' island in the project. Renders the EDS nav
// structure (brand / sections / tools) and ports header.js behavior (mobile hamburger,
// desktop dropdowns, escape + focus-out handling) into a post-hydration effect.
export default function SiteHeader({ brand, sections, tools }) {
  const navRef = useRef(null);

  // Sticky-blur: transparent over the hero, solid + blurred once scrolled.
  useEffect(() => {
    const wrapper = navRef.current?.closest('.nav-wrapper');
    if (!wrapper) return undefined;
    const onScroll = () => wrapper.classList.toggle('is-scrolled', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    const isDesktop = window.matchMedia('(min-width: 900px)');
    const navSections = nav.querySelector('.nav-sections');
    const button = nav.querySelector('.nav-hamburger button');

    const toggleAllNavSections = (expanded = false) => {
      navSections?.querySelectorAll('.default-content-wrapper > ul > li').forEach((s) => {
        s.setAttribute('aria-expanded', expanded);
      });
    };

    const openOnKeydown = (e) => {
      const focused = document.activeElement;
      if (focused.className === 'nav-drop' && (e.code === 'Enter' || e.code === 'Space')) {
        const wasExpanded = focused.getAttribute('aria-expanded') === 'true';
        toggleAllNavSections();
        focused.setAttribute('aria-expanded', wasExpanded ? 'false' : 'true');
      }
    };
    const focusNavSection = () => document.activeElement.addEventListener('keydown', openOnKeydown);

    function toggleMenu(forceExpanded = null) {
      const expanded = forceExpanded !== null
        ? !forceExpanded
        : nav.getAttribute('aria-expanded') === 'true';
      document.body.style.overflowY = expanded || isDesktop.matches ? '' : 'hidden';
      nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      toggleAllNavSections(!expanded && !isDesktop.matches);
      button?.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');

      navSections?.querySelectorAll('.nav-drop').forEach((drop) => {
        if (isDesktop.matches) {
          if (!drop.hasAttribute('tabindex')) {
            drop.setAttribute('tabindex', 0);
            drop.addEventListener('focus', focusNavSection);
          }
        } else {
          drop.removeAttribute('tabindex');
          drop.removeEventListener('focus', focusNavSection);
        }
      });

      // eslint-disable-next-line no-use-before-define
      if (!expanded || isDesktop.matches) {
        window.addEventListener('keydown', closeOnEscape);
        nav.addEventListener('focusout', closeOnFocusLost);
      } else {
        // eslint-disable-next-line no-use-before-define
        window.removeEventListener('keydown', closeOnEscape);
        // eslint-disable-next-line no-use-before-define
        nav.removeEventListener('focusout', closeOnFocusLost);
      }
    }

    function closeOnEscape(e) {
      if (e.code !== 'Escape') return;
      const open = navSections?.querySelector('[aria-expanded="true"]');
      if (open && isDesktop.matches) {
        toggleAllNavSections();
        open.focus();
      } else if (!isDesktop.matches) {
        toggleMenu(false);
        button?.focus();
      }
    }
    function closeOnFocusLost(e) {
      if (nav.contains(e.relatedTarget)) return;
      const open = navSections?.querySelector('[aria-expanded="true"]');
      if (open && isDesktop.matches) toggleAllNavSections(false);
      else if (!isDesktop.matches) toggleMenu(true);
    }

    // mark dropdowns + wire desktop click-to-expand
    const sectionClick = [];
    navSections?.querySelectorAll(':scope .default-content-wrapper > ul > li').forEach((li) => {
      if (li.querySelector('ul')) li.classList.add('nav-drop');
      const handler = () => {
        if (isDesktop.matches) {
          const wasExpanded = li.getAttribute('aria-expanded') === 'true';
          toggleAllNavSections();
          li.setAttribute('aria-expanded', wasExpanded ? 'false' : 'true');
        }
      };
      li.addEventListener('click', handler);
      sectionClick.push([li, handler]);
    });

    const onHamburger = () => toggleMenu();
    button?.addEventListener('click', onHamburger);
    const onChange = () => toggleMenu(isDesktop.matches);
    toggleMenu(isDesktop.matches);
    isDesktop.addEventListener('change', onChange);

    return () => {
      button?.removeEventListener('click', onHamburger);
      isDesktop.removeEventListener('change', onChange);
      window.removeEventListener('keydown', closeOnEscape);
      nav.removeEventListener('focusout', closeOnFocusLost);
      sectionClick.forEach(([li, handler]) => li.removeEventListener('click', handler));
      document.body.style.overflowY = '';
    };
  }, []);

  return (
    <div className="nav-wrapper">
      <nav id="nav" ref={navRef} aria-expanded="false">
        <div className="nav-hamburger">
          <button type="button" aria-controls="nav" aria-label="Open navigation">
            <span className="nav-hamburger-icon" />
          </button>
        </div>
        {/* eslint-disable-next-line react/no-danger */}
        <div className="nav-brand" dangerouslySetInnerHTML={{ __html: brand }} />
        <div className="nav-sections">
          {/* eslint-disable-next-line react/no-danger */}
          <div className="default-content-wrapper" dangerouslySetInnerHTML={{ __html: sections }} />
        </div>
        {/* eslint-disable-next-line react/no-danger */}
        <div className="nav-tools" dangerouslySetInnerHTML={{ __html: tools }} />
      </nav>
    </div>
  );
}
