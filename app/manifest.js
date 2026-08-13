export default function manifest() {
  return {
    name: 'Stacked',
    short_name: 'Stacked',
    description: 'Build your lunch, brick by brick.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f7f4',
    theme_color: '#ff5a2c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
