import { getNav, getFooter } from '../../lib/eds/fragments.js';
import SiteHeader from '../../blocks/header/Header.jsx';
import SiteFooter from '../../blocks/footer/Footer.jsx';

// Layout for content routes: the EDS nav + footer fragments around the page.
// (Bespoke routes outside this group — e.g. /showcase — get the bare root layout.)
export default async function SiteLayout({ children }) {
  const [nav, footer] = await Promise.all([getNav(), getFooter()]);
  return (
    <>
      <header>{nav && <SiteHeader brand={nav.brand} sections={nav.sections} tools={nav.tools} />}</header>
      {children}
      <footer>{footer && <SiteFooter html={footer} />}</footer>
    </>
  );
}
