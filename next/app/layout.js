export const metadata = {
  title: 'next-eds spike',
  description: 'Rendering EDS content via Next.js RSC',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
