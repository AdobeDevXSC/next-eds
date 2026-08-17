import { Spectral, DM_Sans } from 'next/font/google';
import '../styles/styles.css';
import ServiceWorkerRegister from './ServiceWorkerRegister.jsx';

// Self-hosted at build via next/font (satisfies the offline PWA requirement). Roles never swap:
// Spectral = content/display, DM Sans = chrome/UI. See styles/tokens/typography.css.
const spectral = Spectral({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-spectral',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata = {
  title: 'Stacked',
  description: 'Build your lunch, brick by brick.',
  applicationName: 'Stacked',
  appleWebApp: { capable: true, title: 'Stacked', statusBarStyle: 'default' },
  other: { 'apple-mobile-web-app-capable': 'yes' },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#ff7a00',
};

export default function RootLayout({ children }) {
  // styles.css hides the body until `.appear` is added (native EDS does this in scripts.js
  // after decoration). We render server-side, so set it directly.
  return (
    <html lang="en" className={`${spectral.variable} ${dmSans.variable}`}>
      <body className="appear">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
