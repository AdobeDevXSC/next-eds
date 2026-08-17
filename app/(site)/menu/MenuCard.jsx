import Link from 'next/link';
import './menu.css';

// Presentational card for one authored menu item. Server Component — no client JS. Links to
// the item's own content page (/menu/<slug>), rendered by the [[...slug]] catch-all.
export default function MenuCard({ item }) {
  const price = (item.priceCents / 100).toFixed(2);
  return (
    <Link href={`/menu/${item.slug}`} className="menu-card">
      <div className="menu-card-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt={item.name} loading="lazy" />
        {item.special && <span className="menu-card-badge">Special</span>}
      </div>
      <div className="menu-card-body">
        <div className="menu-card-row">
          <h3 className="menu-card-name">{item.name}</h3>
          <span className="menu-card-price">${price}</span>
        </div>
        <p className="menu-card-description">{item.description}</p>
      </div>
    </Link>
  );
}
