'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOrder } from '../../lib/order/OrderProvider.jsx';
import { useDockSlot } from './DockSlot.jsx';
import './shell.css';

// Desktop: sticky top header (wordmark + nav links + Sign in) with a 3px orange accent strip.
// Mobile (< 640px): a compact app header + a docked bottom bar (page action row over a 4-tab
// nav), with safe-area insets. See design_handoff_stacked_home/README.md (2a header, 3a shell).

function TabGlyph({ name }) {
  // Minimal shape glyphs — no asset files (every graphic is a shape). currentColor lets the
  // active/inactive color come from CSS.
  switch (name) {
    case 'home':
      return <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="currentColor" /></svg>;
    case 'menu':
      return (
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <line x1="3" y1="5.5" x2="17" y2="5.5" />
          <line x1="3" y1="10" x2="17" y2="10" />
          <line x1="3" y1="14.5" x2="17" y2="14.5" />
        </svg>
      );
    case 'build':
      return (
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="currentColor">
          <rect x="3" y="4" width="14" height="3.2" rx="1.4" />
          <rect x="3" y="8.4" width="14" height="3.2" rx="1.4" opacity="0.72" />
          <rect x="3" y="12.8" width="14" height="3.2" rx="1.4" opacity="0.5" />
        </svg>
      );
    case 'order':
      return (
        <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <path d="M4 6.5h12l-1 9.5H5z" />
          <path d="M7 6.5a3 3 0 0 1 6 0" />
        </svg>
      );
    default:
      return null;
  }
}

const TABS = [
  { key: 'home', label: 'Home', href: '/', glyph: 'home' },
  { key: 'menu', label: 'Menu', href: '/menu', glyph: 'menu' },
  { key: 'build', label: 'Build', href: '/build', glyph: 'build' },
  { key: 'order', label: 'Order', href: '/order', glyph: 'order' },
];

function activeTab(pathname) {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/menu')) return 'menu';
  if (pathname.startsWith('/build')) return 'build';
  if (pathname.startsWith('/order')) return 'order';
  return '';
}

export default function AppShell({ children }) {
  const pathname = usePathname() || '/';
  const active = activeTab(pathname);
  const { orderCount } = useOrder();
  const { action, chromeless } = useDockSlot();

  // Focused flows (the builder) render their own header + docked bar; the shell steps aside.
  if (chromeless) {
    return <div className="app-shell app-shell-bare">{children}</div>;
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand">
            <span className="brand-square" aria-hidden="true" />
            <span className="brand-word">Stacked</span>
          </Link>
          <nav className="header-nav" aria-label="Primary">
            <Link href="/menu" className="header-nav-link">Menu</Link>
            <Link href="/build" className="header-nav-link">Build your own</Link>
          </nav>
          <Link href="/signin" className="signin-pill">Sign in</Link>
        </div>
        <div className="accent-strip" aria-hidden="true" />
      </header>

      <div className={`app-scroll${action ? ' app-scroll-docked' : ''}`}>{children}</div>

      <div className="docked-bar" role="presentation">
        {action ? <div className="docked-action">{action}</div> : null}
        <nav className="tab-bar" aria-label="App sections">
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`tab${isActive ? ' tab-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="tab-glyph">
                  <TabGlyph name={tab.glyph} />
                  {tab.key === 'order' && orderCount > 0 && (
                    <span className="tab-badge">{orderCount}</span>
                  )}
                </span>
                <span className="tab-label">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
