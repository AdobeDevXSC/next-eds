// EDS global styles: design tokens, fonts, typography, and section layout. Without these the
// page has only per-block CSS and looks unstyled.
import '../styles/styles.css';

export const metadata = {
  title: 'next-eds spike',
  description: 'Rendering EDS content via Next.js RSC',
};

export default function RootLayout({ children }) {
  // styles.css hides the body until `.appear` is added (native EDS does this in scripts.js
  // after decoration). We render server-side, so set it directly.
  return (
    <html lang="en">
      <body className="appear">{children}</body>
    </html>
  );
}
