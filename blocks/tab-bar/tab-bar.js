// Tab Bar — portable OOTB presentation block (Tier 1). The EDS-only twin of the Next app shell's
// mobile bottom navigation (app/(site)/AppShell.jsx's .tab-bar). Fixed bottom bar shown on mobile
// only; on desktop it's hidden and the header nav takes over. Tabs + shape glyphs are baked (no
// asset files), matching the app. The Order tab is a plain link with NO badge — raw EDS has no
// cart state to count. See docs/architecture/blocks-and-rsc.md.
//
// Authored content: an empty block. The tabs below are baked, like the app's TABS constant.
const GLYPHS = {
  home: '<svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"><rect x="1.5" y="1.5" width="13" height="13" rx="3.5" fill="currentColor"/></svg>',
  menu: '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="3" y1="5.5" x2="17" y2="5.5"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="14.5" x2="17" y2="14.5"/></svg>',
  build: '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="currentColor"><rect x="3" y="4" width="14" height="3.2" rx="1.4"/><rect x="3" y="8.4" width="14" height="3.2" rx="1.4" opacity="0.72"/><rect x="3" y="12.8" width="14" height="3.2" rx="1.4" opacity="0.5"/></svg>',
  order: '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 6.5h12l-1 9.5H5z"/><path d="M7 6.5a3 3 0 0 1 6 0"/></svg>',
};

const TABS = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'menu', label: 'Menu', href: '/menu' },
  { key: 'build', label: 'Build', href: '/build' },
  { key: 'order', label: 'Order', href: '/order' },
];

// Match the app's activeTab(): '/' is home; /index-eds is the EDS-only home twin, so it lights the
// Home tab too. Section paths match by prefix.
function activeKey(path) {
  if (path === '/' || path.includes('index-eds')) return 'home';
  if (path.includes('/menu')) return 'menu';
  if (path.includes('/build')) return 'build';
  if (path.includes('/order')) return 'order';
  return '';
}

/**
 * loads and decorates the tab-bar block
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const active = activeKey(window.location.pathname);

  const nav = document.createElement('nav');
  nav.className = 'tab-bar-nav';
  nav.setAttribute('aria-label', 'App sections');

  TABS.forEach((tab) => {
    const a = document.createElement('a');
    a.className = `tab${tab.key === active ? ' tab-active' : ''}`;
    a.href = tab.href;
    if (tab.key === active) a.setAttribute('aria-current', 'page');

    const glyph = document.createElement('span');
    glyph.className = 'tab-glyph';
    glyph.innerHTML = GLYPHS[tab.key];

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = tab.label;

    a.append(glyph, label);
    nav.append(a);
  });

  block.textContent = '';
  block.append(nav);
}
