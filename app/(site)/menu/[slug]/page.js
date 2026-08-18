import { notFound } from 'next/navigation';
import { getMenuItem } from '../../../../lib/catalog.js';
import { getCurrentUser } from '../../../../lib/session.js';
import { getFlags } from '../../../../lib/flags.js';
import MenuItemDetail from './MenuItemDetail.jsx';
import './menu-item.css';

// getCurrentUser() reads the session cookie and getFlags() reads KV — both per-request,
// via getCloudflareContext(), which only resolves inside a real request. Force per-request
// rendering (same pattern as signin/page.js) so a flag toggle or sign-in/out is reflected
// immediately instead of serving a stale prerendered shell.
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const item = await getMenuItem(slug);
  return { title: item ? `${item.name} — Stacked` : 'Menu — Stacked' };
}

export default async function MenuItemPage({ params }) {
  const { slug } = await params;
  const [item, user, flags] = await Promise.all([getMenuItem(slug), getCurrentUser(), getFlags()]);
  if (!item) notFound();

  return (
    <main className="menu-item">
      <div className="menu-item-inner">
        <div className="menu-item-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt={item.name} />
          {item.special && <span className="menu-item-badge">Special</span>}
        </div>
        <div className="menu-item-body">
          <h1 className="menu-item-name">{item.name}</h1>
          <p className="menu-item-desc">{item.description}</p>
          <MenuItemDetail item={item} showSignInPrompt={!user && flags.loyalty} />
        </div>
      </div>
    </main>
  );
}
