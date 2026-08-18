// Guardrail: Tier-1 blocks must be portable vanilla JS. A .jsx file under blocks/ is exactly
// what broke raw-EDS rendering (browsers can't parse JSX). Fail the lint if any reappears.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = 'blocks';
const offenders = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (entry.endsWith('.jsx')) offenders.push(p);
  }
};
walk(root);

if (offenders.length) {
  console.error('Tier-1 blocks must be vanilla JS — remove these .jsx files:');
  offenders.forEach((f) => console.error(`  ${f}`));
  process.exit(1);
}
console.log('lint:blocks OK — no .jsx under blocks/');
