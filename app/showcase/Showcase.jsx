'use client';

import { useEffect, useRef, useState } from 'react';
import './showcase.css';

/* ── scroll engine ─────────────────────────────────────────────────────────
   rAF-throttled scroll loop drives every [data-parallax] via translate3d. */
function useParallax() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('[data-parallax]'));
    let ticking = false;
    const update = () => {
      const vh = window.innerHeight;
      els.forEach((el) => {
        const speed = parseFloat(el.dataset.parallax) || 0;
        const rect = el.getBoundingClientRect();
        const center = rect.top + rect.height / 2 - vh / 2;
        el.style.transform = `translate3d(0, ${(-center * speed).toFixed(1)}px, 0)`;
      });
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
    };
  }, []);
}

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) e.target.dataset.revealed = '1'; });
    }, { threshold: 0.18 });
    document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Reveal({ children, delay = 0, style }) {
  return (
    <div
      data-reveal=""
      style={{
        opacity: 0,
        transform: 'translateY(28px)',
        transition: `opacity .7s var(--ease-out) ${delay}s, transform .7s var(--ease-out) ${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Bound({ children, style }) {
  return (
    <div style={{ maxWidth: 'var(--content-width)', margin: '0 auto', padding: '0 24px', ...style }}>
      {children}
    </div>
  );
}

function Eyebrow({ children, light }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: '13px', fontWeight: 500, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: light ? '#9db8e8' : 'var(--accent-blue-deep)', marginBottom: '14px',
    }}>{children}</span>
  );
}

/* ── primitives (ported from the DS components) ────────────────────────────── */
function Card({ eyebrow, title, children, style }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      border: '1px solid var(--border-color)', borderRadius: '14px',
      background: 'var(--surface-card)', overflow: 'hidden', ...style,
    }}>
      <div style={{ margin: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {eyebrow && (
          <span style={{
            fontSize: '12px', fontWeight: 500, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--accent-blue-deep)',
          }}>{eyebrow}</span>
        )}
        {title && (
          <h4 style={{ margin: 0, fontFamily: 'var(--heading-font-family)', fontSize: 'var(--heading-font-size-m)' }}>{title}</h4>
        )}
        <div style={{ color: 'var(--text-muted)', fontSize: '0.95em', lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );
}

function Badge({ tone = 'neutral', children }) {
  const tones = {
    neutral: { background: 'var(--slate-100)', color: 'var(--slate-700)' },
    blue: { background: 'var(--accent-blue-soft)', color: 'var(--accent-blue-deep)' },
    ink: { background: 'var(--text-color)', color: 'var(--background-color)' },
  };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--radius-chip)',
      fontSize: '12px', fontWeight: 500, ...tones[tone],
    }}>{children}</span>
  );
}

function FileCard({ filename, children }) {
  return (
    <div style={{
      border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-card)',
      padding: '16px', background: 'var(--surface-card)',
    }}>
      <code style={{
        display: 'inline-block', background: 'var(--surface-fill)', color: 'var(--slate-700)',
        padding: '2px 8px', borderRadius: 'var(--radius-chip)', fontFamily: 'var(--fixed-font-family)', fontSize: '0.9em',
      }}>{filename}</code>
      <p style={{ margin: '10px 0 0', color: 'var(--text-muted)', fontSize: '0.9em', lineHeight: 1.5 }}>{children}</p>
    </div>
  );
}

function Steps({ steps = [], columns = 4 }) {
  return (
    <ol style={{
      listStyle: 'none', margin: 0, padding: 0, display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '16px',
    }} className="steps-grid">
      {steps.map((s, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <li key={i} style={{
          display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px',
          border: '1px solid var(--border-hairline)', borderRadius: 'var(--radius-card)', background: 'var(--surface-card)',
        }}>
          <span aria-hidden="true" style={{
            width: '28px', height: '28px', borderRadius: 'var(--radius-round)',
            background: 'var(--accent-blue-soft)', color: 'var(--accent-blue-deep)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px',
          }}>{i + 1}</span>
          <div>
            <p style={{ margin: 0, fontWeight: 700 }}>{s.title}</p>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: '0.9em', lineHeight: 1.5 }}>{s.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Tabs({ tabs = [] }) {
  const [active, setActive] = useState(0);
  return (
    <div>
      <div role="tablist" style={{ display: 'flex', gap: '0.5ch', overflowX: 'auto' }}>
        {tabs.map((t, i) => {
          const selected = i === active;
          return (
            <button
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(i)}
              style={{
                flex: '0 0 max-content', margin: 0, border: '1px solid var(--dark-color)',
                borderBottom: selected ? '1px solid var(--background-color)' : '1px solid var(--dark-color)',
                borderRadius: 0, padding: '0.5em 0.9em',
                background: selected ? 'var(--background-color)' : 'var(--slate-100)',
                color: selected ? 'var(--text-color)' : 'var(--slate-700)',
                fontWeight: 700, fontSize: 'var(--body-font-size-s)',
                cursor: selected ? 'default' : 'pointer', position: 'relative', zIndex: selected ? 1 : 0,
              }}
            >{t.label}</button>
          );
        })}
      </div>
      <div role="tabpanel" style={{
        marginTop: '-1px', padding: '24px', border: '1px solid var(--dark-color)', background: 'var(--background-color)',
      }}>{tabs[active]?.content}</div>
    </div>
  );
}

/* ── scenes ─────────────────────────────────────────────────────────────────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const links = ['Capabilities', 'How it works', 'Blocks', 'Docs'];
  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 'var(--nav-height)',
      background: scrolled ? 'rgba(255,255,255,0.85)' : 'transparent',
      backdropFilter: scrolled ? 'saturate(180%) blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--slate-200)' : '1px solid transparent',
      transition: 'background .3s var(--ease-standard), border-color .3s, backdrop-filter .3s',
    }}>
      <nav style={{
        maxWidth: 'var(--nav-width)', margin: '0 auto', height: '100%', padding: '0 32px',
        display: 'flex', alignItems: 'center', gap: '32px',
      }}>
        <a href="#top" style={{
          display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none',
          color: scrolled ? 'var(--text-color)' : '#fff', fontFamily: 'var(--heading-font-family)',
          fontWeight: 700, fontSize: '20px',
        }}>
          <span style={{
            width: '26px', height: '26px', borderRadius: '7px', background: 'var(--accent-blue)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '15px',
          }}>◆</span>
          EDS
        </a>
        <div style={{ flex: 1, display: 'flex', gap: '26px', justifyContent: 'flex-end', alignItems: 'center' }}>
          {links.map((l) => (
            <a key={l} href={`#${l.toLowerCase().replace(/\s/g, '-')}`} style={{
              color: scrolled ? 'var(--slate-700)' : 'rgba(255,255,255,0.88)', fontSize: '15px', fontWeight: 500, textDecoration: 'none',
            }}>{l}</a>
          ))}
          <a href="#start" className="button accent" style={{ fontSize: '14px', padding: '0.45em 1.1em' }}>Get started</a>
        </div>
      </nav>
    </header>
  );
}

function ParallaxHero() {
  const bg = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=2000&q=80';
  return (
    <section id="top" style={{
      position: 'relative', minHeight: '100vh', overflow: 'hidden', display: 'flex',
      alignItems: 'center', isolation: 'isolate', background: 'var(--slate-950)',
    }}>
      <div data-parallax="0.28" style={{
        position: 'absolute', inset: '-15% 0', zIndex: -3,
        backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center', willChange: 'transform',
      }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: -2, background: 'linear-gradient(115deg, rgba(2,6,23,0.92) 0%, rgba(2,6,23,0.78) 42%, rgba(2,6,23,0.35) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: -1, background: 'radial-gradient(80% 60% at 18% 30%, rgba(37,99,235,0.28), transparent 70%)' }} />
      <Bound>
        <div data-parallax="-0.06" style={{ maxWidth: '760px', willChange: 'transform' }}>
          <Reveal>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', borderRadius: '2.4em',
              border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.06)', color: '#cfe0ff',
              fontSize: '13px', fontWeight: 500, marginBottom: '26px',
            }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#46d39a' }} />
              Edge Delivery Services · Next.js render layer
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 style={{ margin: 0, color: '#fff', fontFamily: 'var(--heading-font-family)', fontSize: 'clamp(44px, 7vw, 92px)', lineHeight: 0.98, letterSpacing: '-0.02em' }}>
              Author anywhere.<br />Render at the edge.
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p style={{ margin: '26px 0 0', maxWidth: '540px', color: '#cbd5e1', fontSize: '20px', lineHeight: 1.55 }}>
              EDS turns documents into 100/100 web pages — content stays headless in Docs and DA, blocks
              decorate the markup, and a Cloudflare Worker renders it all in milliseconds.
            </p>
          </Reveal>
          <Reveal delay={0.18}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '34px' }}>
              <a href="#start" className="button accent" style={{ fontSize: '16px', padding: '0.7em 1.5em' }}>Get started</a>
              <a href="#capabilities" className="button" style={{ fontSize: '16px', padding: '0.7em 1.5em', color: '#fff', borderColor: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.08)' }}>See capabilities →</a>
            </div>
          </Reveal>
        </div>
      </Bound>
    </section>
  );
}

function Capabilities() {
  const features = [
    { eyebrow: 'Authoring', title: 'Docs & DA, not a CMS', body: 'Authors write in Google Docs, SharePoint or Document Authoring. Content stays headless; the sidekick previews instantly.' },
    { eyebrow: 'Performance', title: 'Three-phase loading', body: 'Eager loads only what LCP needs. Lazy brings header, footer and below-fold blocks. Delayed defers martech.' },
    { eyebrow: 'Architecture', title: 'Blocks decorate markup', body: 'Each block owns a folder — JS transforms the DOM, scoped CSS styles it. Re-usable, self-contained, accessible by default.' },
    { eyebrow: 'Rendering', title: 'React Server Components', body: 'The Next.js layer renders blocks to HTML with zero client JavaScript, preserving the EDS performance profile.' },
    { eyebrow: 'Delivery', title: 'Rendered at the edge', body: 'A Cloudflare Worker fronts EDS and renders pages at the edge — preview on .aem.page, publish to .aem.live.' },
    { eyebrow: 'Quality', title: 'David’s Model', body: 'Opinionated defaults keep markup clean and pages fast, so every project starts at 100 and stays there.' },
  ];
  return (
    <section id="capabilities" style={{ position: 'relative', padding: '120px 0 100px', background: '#fff', overflow: 'hidden' }}>
      <div data-parallax="0.12" style={{
        position: 'absolute', top: '-80px', right: '-120px', width: '460px', height: '460px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.10), transparent 70%)', zIndex: 0, willChange: 'transform',
      }} />
      <Bound style={{ position: 'relative', zIndex: 1 }}>
        <Reveal>
          <Eyebrow>What you get</Eyebrow>
          <h2 style={{ margin: 0, fontSize: 'clamp(34px, 4.4vw, 56px)', lineHeight: 1.04, letterSpacing: '-0.02em', maxWidth: '720px' }}>
            Everything to ship fast pages, nothing to slow them down
          </h2>
        </Reveal>
        <div style={{ marginTop: '52px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.06}>
              <Card eyebrow={f.eyebrow} title={f.title}>{f.body}</Card>
            </Reveal>
          ))}
        </div>
      </Bound>
    </section>
  );
}

function MetricsBand() {
  const bg = 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=2000&q=80';
  const stats = [
    { value: '100', label: 'Lighthouse — all four' },
    { value: '0 kb', label: 'Client JS with RSC' },
    { value: '<1s', label: 'Time to first byte' },
    { value: '40+', label: 'Block collection' },
  ];
  return (
    <section style={{ position: 'relative', padding: '110px 0', overflow: 'hidden', isolation: 'isolate', background: 'var(--slate-950)' }}>
      <div data-parallax="0.22" style={{
        position: 'absolute', inset: '-15% 0', zIndex: -2,
        backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.28, willChange: 'transform',
      }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: -1, background: 'linear-gradient(rgba(2,6,23,0.86), rgba(2,6,23,0.82))' }} />
      <Bound>
        <Reveal>
          <Eyebrow light>By the numbers</Eyebrow>
          <h2 style={{ margin: '0 0 50px', color: '#fff', fontSize: 'clamp(30px, 4vw, 48px)', letterSpacing: '-0.02em', maxWidth: '640px' }}>
            Performance isn’t a phase. It’s the default.
          </h2>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '18px' }}>
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.07}>
              <div style={{ padding: '28px 24px', borderRadius: '16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)' }}>
                <p style={{ margin: 0, color: '#fff', fontFamily: 'var(--heading-font-family)', fontSize: '48px', lineHeight: 1, letterSpacing: '-0.02em' }}>{s.value}</p>
                <p style={{ margin: '10px 0 0', color: '#9fb2cc', fontSize: '14px' }}>{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Bound>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" style={{ padding: '120px 0', background: 'var(--light-color)' }}>
      <Bound>
        <Reveal>
          <Eyebrow>The flow</Eyebrow>
          <h2 style={{ margin: 0, fontSize: 'clamp(34px, 4.4vw, 56px)', lineHeight: 1.04, letterSpacing: '-0.02em', maxWidth: '680px' }}>
            From a document to the edge in four moves
          </h2>
        </Reveal>
        <Reveal delay={0.1} style={{ marginTop: '52px' }}>
          <Steps columns={4} steps={[
            { title: 'Author', description: 'Write content in Docs, SharePoint or DA — no code, no deploy.' },
            { title: 'Preview', description: 'Sidekick previews to your branch on *.aem.page instantly.' },
            { title: 'Decorate', description: 'Blocks transform plain markup into rich, scoped components.' },
            { title: 'Publish', description: 'Promote to *.aem.live and the worker serves it at the edge.' },
          ]} />
        </Reveal>
      </Bound>
    </section>
  );
}

function BlockAnatomy() {
  return (
    <section id="blocks" style={{ position: 'relative', padding: '120px 0', background: '#fff', overflow: 'hidden' }}>
      <div data-parallax="0.1" style={{
        position: 'absolute', left: '-140px', bottom: '40px', width: '420px', height: '420px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(24,95,165,0.08), transparent 70%)', willChange: 'transform',
      }} />
      <Bound style={{ position: 'relative', zIndex: 1 }}>
        <div className="anatomy-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', gap: '56px', alignItems: 'center' }}>
          <Reveal>
            <div>
              <Eyebrow>Anatomy of a block</Eyebrow>
              <h2 style={{ margin: '0 0 18px', fontSize: 'clamp(30px, 3.6vw, 46px)', lineHeight: 1.06, letterSpacing: '-0.02em' }}>
                Three files. One folder. Endlessly reusable.
              </h2>
              <p style={{ margin: '0 0 26px', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1.6 }}>
                Every block lives in <code style={{ fontFamily: 'var(--fixed-font-family)', background: 'var(--slate-100)', padding: '1px 7px', borderRadius: '5px', fontSize: '0.85em' }}>/blocks/&lt;name&gt;/</code>,
                colocated with its CSS and reached through a lowercase entry shim.
              </p>
              <div style={{ display: 'grid', gap: '12px' }}>
                <FileCard filename="hero/Hero.jsx">React Server Component — renders the block to HTML with zero client JS.</FileCard>
                <FileCard filename="hero/hero.css">Scoped styles. Every selector is prefixed with the block name.</FileCard>
                <FileCard filename="hero/hero.js">Entry shim that registers the block in the registry.</FileCard>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <div>
              <Tabs tabs={[
                { label: 'Hero.jsx', content: <pre>{`export default function Hero({ rows }) {
  const html = rows?.[0]?.[0]?.html ?? '';
  return (
    <div className="hero block">
      <div
        className="hero-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}`}</pre> },
                { label: 'hero.css', content: <pre>{`.hero {
  position: relative;
  isolation: isolate;
  min-height: 420px;
}
.hero::before {     /* contrast scrim */
  content: "";
  position: absolute;
  inset: 0;
  background: var(--scrim);
}`}</pre> },
                { label: 'registry.js', content: <pre>{`import Hero from '../blocks/hero/hero.js';
import Cards from '../blocks/cards/cards.js';

// block name → React component
export const registry = {
  hero: Hero,
  cards: Cards,
  columns: Columns,
};`}</pre> },
              ]} />
              <div style={{ marginTop: '14px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Badge tone="blue">RSC</Badge>
                <Badge tone="neutral">Scoped CSS</Badge>
                <Badge tone="ink">Auto-blocking</Badge>
              </div>
            </div>
          </Reveal>
        </div>
      </Bound>
    </section>
  );
}

function FooterKit() {
  const cols = [
    { h: 'Product', links: ['Capabilities', 'Block collection', 'Performance', 'Changelog'] },
    { h: 'Develop', links: ['Tutorial', 'Anatomy of a project', 'Markup reference', 'AGENTS.md'] },
    { h: 'Resources', links: ['aem.live docs', 'David’s Model', 'Keeping it 100', 'GitHub'] },
  ];
  return (
    <>
      <section id="start" style={{ position: 'relative', padding: '120px 0', background: 'var(--slate-950)', overflow: 'hidden', isolation: 'isolate' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: -1, background: 'radial-gradient(70% 80% at 50% 0%, rgba(37,99,235,0.25), transparent 65%)' }} />
        <Bound>
          <Reveal style={{ textAlign: 'center' }}>
            <div style={{ maxWidth: '680px', margin: '0 auto' }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: 'clamp(34px, 5vw, 60px)', lineHeight: 1.02, letterSpacing: '-0.02em' }}>
                Start at 100. Stay there.
              </h2>
              <p style={{ margin: '20px 0 34px', color: '#cbd5e1', fontSize: '19px', lineHeight: 1.55 }}>
                Clone the boilerplate, add a mountpoint, and your first page is live in minutes.
              </p>
              <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <a href="#top" className="button accent" style={{ fontSize: '16px', padding: '0.7em 1.6em' }}>Get started</a>
                <a href="#blocks" className="button" style={{ fontSize: '16px', padding: '0.7em 1.6em', color: '#fff', borderColor: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.08)' }}>Read the docs</a>
              </div>
              <p style={{ marginTop: '26px', fontFamily: 'var(--fixed-font-family)', fontSize: '13px', color: '#7e93b3' }}>npx -y @adobe/aem-cli up</p>
            </div>
          </Reveal>
        </Bound>
      </section>
      <footer style={{ background: '#0a0f1d', color: '#9fb2cc', padding: '64px 0 40px' }}>
        <Bound>
          <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(3, 1fr)', gap: '32px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '14px' }}>
                <span style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'var(--accent-blue)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '15px' }}>◆</span>
                <span style={{ fontFamily: 'var(--heading-font-family)', fontWeight: 700, fontSize: '20px', color: '#fff' }}>EDS</span>
              </div>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, maxWidth: '260px' }}>
                Edge Delivery Services with a Next.js render layer. Author anywhere, render at the edge.
              </p>
            </div>
            {cols.map((c) => (
              <div key={c.h}>
                <p style={{ margin: '0 0 14px', color: '#fff', fontSize: '13px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{c.h}</p>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '10px' }}>
                  {c.links.map((l) => (<li key={l}><a href="#top" style={{ color: '#9fb2cc', fontSize: '14px', textDecoration: 'none' }}>{l}</a></li>))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', fontSize: '13px' }}>
            <span>Built on the AEM boilerplate · next-eds</span>
            <span>© 2026 · next-eds design-system showcase</span>
          </div>
        </Bound>
      </footer>
    </>
  );
}

export default function Showcase() {
  useParallax();
  useReveal();
  return (
    <div className="showcase">
      <Nav />
      <ParallaxHero />
      <Capabilities />
      <MetricsBand />
      <HowItWorks />
      <BlockAnatomy />
      <FooterKit />
    </div>
  );
}
