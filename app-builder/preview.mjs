// Local preview helper: convert an EDS page to email HTML and write it to dist/.
// Usage:
//   npm run preview -- <path> [live]
//   npm run preview -- /email/welcome
//   npm run preview -- /menu/italian-stack live
// Then open the printed dist/*.html file in a browser (images load from the EDS origin).
// This is a dev convenience only — it invokes the same main() the deployed action runs.
import { writeFileSync, mkdirSync } from 'node:fs';
import { main } from './actions/convert-email/index.js';

const path = process.argv[2] || '/email/welcome';
const env = process.argv[3] === 'live' ? 'live' : 'preview';

// preview=true → the action returns raw text/html we can drop straight into a file.
const html = await main({ path, env, preview: 'true' });
if (html.statusCode !== 200) {
  console.error(`✗ ${path} (${env}) → ${html.statusCode}: ${JSON.stringify(html.body)}`);
  process.exit(1);
}

mkdirSync('dist', { recursive: true });
const slug = path.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'index';
const out = `dist/${slug}.html`;
writeFileSync(out, html.body);

// JSON mode gives the warnings + which blocks were rendered, for a quick console summary.
const json = await main({ path, env });
console.log(`✓ ${path} (${env}) → ${out}  (${html.body.length} bytes)`);
console.log(`  blocks:   ${JSON.stringify(json.body.meta.blocksRendered)}`);
console.log(`  warnings: ${JSON.stringify(json.body.warnings)}`);
console.log(`  open:     open ${process.cwd()}/${out}`);
