import Hero from './hero/Hero.js';

// Maps an EDS block name → a React component. Static blocks are Server Components
// (zero client JS); interactive blocks would be dynamically imported 'use client' islands.
export const registry = {
  hero: Hero,
};

export function resolveBlock(name) {
  return registry[name] || null;
}
