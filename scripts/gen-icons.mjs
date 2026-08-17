import sharp from 'sharp';

const jobs = [
  ['public/icons/icon.svg', 'public/icons/icon-192.png', 192],
  ['public/icons/icon.svg', 'public/icons/icon-512.png', 512],
  ['public/icons/icon.svg', 'public/icons/apple-touch-icon.png', 180],
  ['public/icons/icon-maskable.svg', 'public/icons/icon-maskable-512.png', 512],
];

await Promise.all(jobs.map(([src, out, size]) =>
  sharp(src).resize(size, size).png({ compressionLevel: 9 }).toFile(out)));

console.log('icons written');
