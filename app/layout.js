// EDS global styles: design tokens, fonts, typography, and section layout. Without these the
// page has only per-block CSS and looks unstyled.
import '../styles/styles.css';
import ServiceWorkerRegister from './ServiceWorkerRegister.jsx';

export const metadata = {
  title: 'Stacked',
  description: 'Build your lunch, brick by brick.',
  applicationName: 'Stacked',
  appleWebApp: { capable: true, title: 'Stacked', statusBarStyle: 'default' },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#ff5a2c',
};

export default function RootLayout({ children }) {
  // styles.css hides the body until `.appear` is added (native EDS does this in scripts.js
  // after decoration). We render server-side, so set it directly.
  // Header/footer live in the (site) layout so bespoke routes (e.g. /showcase) can opt out.
  return (
    <html lang="en">
      <body className="appear">
        <link
          rel="preload"
          href="/fonts/bricolage-grotesque-variable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
