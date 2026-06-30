'use client';

import { useEffect } from 'react';

// Client enhancement for the content homepage: parallax drift on the hero image and
// reveal-on-scroll for sections. Renders nothing. Progressive — gated behind the
// data-effects flag so content is fully visible if JS never runs.
// (The reveal CSS lives in styles/styles.css — it's section-level layout, not block CSS.)
export default function PageEffects() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-effects', 'on');

    // reveal-on-scroll: only sections below the fold animate in (skip the hero, and leave
    // already-visible sections untouched so there's no flash).
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('reveal-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    Array.from(document.querySelectorAll('main > .section')).slice(1).forEach((s) => {
      if (s.getBoundingClientRect().top > window.innerHeight * 0.85) {
        s.classList.add('reveal');
        io.observe(s);
      }
    });

    // parallax drift on the hero background image (the transparent-over-hero nav is handled
    // in CSS via :has(), so there's no flag to set here).
    const pic = document.querySelector('main > .section:first-of-type .hero picture');
    let ticking = false;
    const update = () => {
      if (pic) pic.style.transform = `translate3d(0, ${(window.scrollY * 0.12).toFixed(1)}px, 0)`;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      root.removeAttribute('data-effects');
    };
  }, []);

  return null;
}
