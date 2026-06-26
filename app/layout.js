// EDS global styles: design tokens, fonts, typography, and section layout. Without these the
// page has only per-block CSS and looks unstyled.
import '../styles/styles.css';
import { getNav, getFooter } from '../lib/eds/fragments.js';
import SiteHeader from '../blocks/header/Header.jsx';
import SiteFooter from '../blocks/footer/Footer.jsx';

export const metadata = {
  title: 'next-eds spike',
  description: 'Rendering EDS content via Next.js RSC',
};

export default async function RootLayout({ children }) {
  // Fetch the nav + footer fragments at build/request time (same source EDS decorates).
  const [nav, footer] = await Promise.all([getNav(), getFooter()]);

  // styles.css hides the body until `.appear` is added (native EDS does this in scripts.js
  // after decoration). We render server-side, so set it directly.
  return (
    <html lang="en">
      <body className="appear">
        <header>{nav && <SiteHeader brand={nav.brand} sections={nav.sections} tools={nav.tools} />}</header>
        {children}
        <footer>{footer && <SiteFooter html={footer} />}</footer>
      </body>
    </html>
  );
}
