import Showcase from './Showcase.jsx';

export const metadata = {
  title: 'EDS — Author anywhere, render at the edge',
  description: 'A parallax capabilities + docs showcase for the EDS Design System.',
};

// Bespoke marketing route. Outside the (site) group, so it gets the bare root layout
// (no EDS nav/footer) and renders its own parallax chrome.
export default function ShowcasePage() {
  return <Showcase />;
}
