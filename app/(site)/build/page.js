import { getIngredients } from '../../../lib/catalog.js';
import SandwichBuilder from './SandwichBuilder.jsx';
import './build.css';

export const metadata = {
  title: 'Build your own — Stacked',
  description: 'Stack your own sandwich from the authored ingredient palette, brick by brick.',
};

const TYPES = ['bread', 'protein', 'cheese', 'veg', 'sauce', 'extra'];

// Explicit route: /build wins over the [[...slug]] catch-all. Reads the authored ingredient
// palette directly — this is app UI, not EDS content. Ships zero client JS when the palette
// is empty (SandwichBuilder — the only client component this route can render — is never
// mounted in that case).
export default async function BuildPage() {
  const palette = await getIngredients();
  const hasIngredients = TYPES.some((type) => (palette[type] || []).length > 0);

  return (
    <main>
      <div className="section">
        <div className="build-page">
          <h1>Build your own</h1>
          {hasIngredients ? (
            <SandwichBuilder palette={palette} />
          ) : (
            <p className="build-empty">The ingredient palette isn&rsquo;t set up yet — check back soon.</p>
          )}
        </div>
      </div>
    </main>
  );
}
