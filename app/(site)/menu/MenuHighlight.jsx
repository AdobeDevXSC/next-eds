import MenuCard from './MenuCard.jsx';
import './menu-highlight.css';

const HIGHLIGHT_COUNT = 3;

// Server-rendered "today's picks" strip for the home page: the authored menu's special items
// (or, absent any, its first few), read straight from the catalog — not authored EDS content.
// Renders nothing when the catalog is empty (no sandwiches authored yet).
export default function MenuHighlight({ items }) {
  if (!items.length) return null;
  const picks = items.filter((item) => item.special).slice(0, HIGHLIGHT_COUNT);
  const shown = picks.length ? picks : items.slice(0, HIGHLIGHT_COUNT);

  return (
    <div className="section">
      <div className="menu-highlight">
        <h2>Today&rsquo;s picks</h2>
        <div className="menu-highlight-grid">
          {shown.map((item) => <MenuCard key={item.slug} item={item} />)}
        </div>
      </div>
    </div>
  );
}
