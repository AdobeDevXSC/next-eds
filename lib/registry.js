// Maps an EDS block name → its React component. Blocks live in the repo-root /blocks folder,
// colocated with their CSS; each is reached through its lowercase entry shim (e.g. hero.js).
// Static blocks are Server Components (zero client JS); interactive blocks would be 'use client'.
import Hero from '../blocks/hero/hero.js';
import Cards from '../blocks/cards/cards.js';
import Columns from '../blocks/columns/columns.js';
import Steps from '../blocks/steps/steps.js';
import Tabs from '../blocks/tabs/tabs.js';
import Callout from '../blocks/callout/callout.js';

export const registry = {
  hero: Hero,
  cards: Cards,
  columns: Columns,
  steps: Steps,
  tabs: Tabs,
  callout: Callout,
};

export function resolveBlock(name) {
  return registry[name] || null;
}
