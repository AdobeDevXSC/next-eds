import { getBuilderPalette } from '../../../lib/content.js';
import Builder from './Builder.jsx';
import './build.css';

export const metadata = {
  title: 'Build your own — Stacked',
  description: 'Assemble a custom sandwich from the ingredient palette — see the stack and price change with every tap.',
};

// Explicit route: /build wins over the [[...slug]] catch-all. The palette comes from
// content/builder-palette.json (see the redesign spec); the interactive builder is client-side.
export default function BuildPage() {
  const palette = getBuilderPalette();
  return <Builder palette={palette} />;
}
