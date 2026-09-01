// Escape hatch — by convention every content block is a portable vanilla OOTB block
// (blocks/<name>/<name>.js decorate() + CSS) rendered in Next via lib/eds/LegacyBlock.jsx, and
// natively by aem.js on the raw EDS URL. Add an entry here ONLY to opt one specific block into
// RSC server rendering. See docs/architecture/blocks-and-rsc.md.
import TodaysPick from '../components/blocks/TodaysPick.jsx';
import DockCtas from '../components/blocks/DockCtas.jsx';

// The two entries below are the deliberate Tier-2 exception: they need app state (cart, mobile
// dock) that only exists in the Next app, so they're intentionally absent on raw EDS. See
// components/blocks/TodaysPick.jsx and components/blocks/DockCtas.jsx.
export const registry = {
  'todays-pick': TodaysPick,
  'dock-ctas': DockCtas,
};

export function resolveBlock(name) {
  return registry[name] || null;
}
