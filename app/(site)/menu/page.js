import { getMenu } from '../../../lib/catalog.js';
import MenuCard from './MenuCard.jsx';
import './menu.css';

export const metadata = {
  title: 'Menu — Stacked',
  description: 'Shop the menu or build your own sandwich, brick by brick.',
};

// Explicit route: /menu wins over the [[...slug]] catch-all for this literal path. Reads the
// authored catalog (menu/query-index.json) directly — this is app UI, not EDS content.
export default async function MenuPage() {
  const items = await getMenu();

  return (
    <main>
      <div className="section">
        <div className="menu-page">
          <h1>Menu</h1>
          {items.length === 0 ? (
            <p className="menu-empty">No sandwiches on the menu yet — check back soon.</p>
          ) : (
            <div className="menu-grid">
              {items.map((item) => <MenuCard key={item.slug} item={item} />)}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
