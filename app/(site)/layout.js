import { getNav, getFooter } from '../../lib/eds/fragments.js';
import { fetchQueryIndex } from '../../lib/eds/queryIndex.js';
import { enrichNav } from '../../lib/eds/nav.js';
import SiteHeader from '../../blocks/header/Header.jsx';
import SiteFooter from '../../blocks/footer/Footer.jsx';
import PageEffects from '../PageEffects.jsx';

// Layout for content routes: the EDS nav + footer fragments around the page, plus the
// homepage motion (parallax hero + reveal-on-scroll) applied to the real content.
// The nav's submenu links are enriched from query-index.json so the header can render a
// mega-menu with a featured image/description per link.
export default async function SiteLayout({ children }) {
  const [nav, footer, indexMap] = await Promise.all([getNav(), getFooter(), fetchQueryIndex()]);
  const sections = nav ? enrichNav(nav.sections, indexMap) : [];
  return (
    <>
      <header>{nav && <SiteHeader brand={nav.brand} sections={sections} tools={nav.tools} />}</header>
      {children}
      <footer>{footer && <SiteFooter html={footer} />}</footer>
      <PageEffects />
    </>
  );
}
