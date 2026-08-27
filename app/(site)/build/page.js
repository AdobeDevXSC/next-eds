import { getBuilderPalette } from '../../../lib/catalog.js';
import Builder from './Builder.jsx';
import './build.css';

export const metadata = {
  title: 'Build your own — Stacked',
  description: 'Assemble a custom sandwich from the ingredient palette — see the stack and price change with every tap.',
};

// Explicit route: /build wins over the [...slug] catch-all. The palette is authored as the
// Ingredients block at /config/ingredients (see docs/content-schema.md); the interactive
// builder is client-side.
export default async function BuildPage() {
  const palette = await getBuilderPalette();
  return <Builder palette={palette} />;
}
