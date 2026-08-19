#!/usr/bin/env node
/**
 * Sync selected repo docs → a Wovea "Brain Board" as Markdown documents in a collection.
 *
 * Usage:
 *   npm run sync:wovea-docs                          # reads WOVEA_TOKEN from .env.local
 *   WOVEA_TOKEN=wovea_sk_... node scripts/sync-wovea-docs.mjs
 *   WOVEA_BOARD_ID=<uuid> npm run sync:wovea-docs    # target a different board
 *
 * Behavior — CREATE-IF-MISSING (idempotent add):
 *   The Wovea API is create-only for documents; it exposes no documented update or delete
 *   (only board-level delete). So this script:
 *     - never creates duplicates: it skips any doc whose `name` already exists on the board;
 *     - cannot push CONTENT UPDATES to a doc that already exists — to refresh a changed doc,
 *       delete it in the Wovea UI first, then re-run;
 *     - is non-destructive to all other board content (cards, links, canvas, notes).
 *
 * Config lives in the DOCS manifest below (repo path → Wovea document name).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const API = process.env.WOVEA_API || 'https://api.wovea.ai';
const BOARD = process.env.WOVEA_BOARD_ID || 'cd92e0ba-636a-4a6f-bb77-673255f96d89';
const COLLECTION = process.env.WOVEA_COLLECTION || 'Documentation';
const TOKEN = process.env.WOVEA_TOKEN;

// Repo root = this file's parent's parent (scripts/ -> repo root).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// repo file (relative to repo root) → Wovea document name. Edit to add/remove synced docs.
const DOCS = [
  ['AGENTS.md', 'Project Architecture & Conventions'],
  ['docs/DESIGN.md', 'Design System: Stacked'],
  ['docs/PRODUCT.md', 'Product Overview'],
  ['docs/content-schema.md', 'Content Schema (EDS structured content)'],
  ['DEPLOYMENT.md', 'Deployment — Next.js + EDS on Cloudflare'],
  ['app-builder/README.md', 'Email Action — Architecture & Deploy'],
  ['docs/superpowers/specs/2026-08-18-eds-to-email-action-design.md', 'Email Action — Design Spec'],
];

if (!TOKEN) {
  console.error('Missing WOVEA_TOKEN. Add it to .env.local (npm run sync:wovea-docs) or export it.');
  process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const pickId = (j) => j?.collection?.id || j?.document?.id || j?.data?.id || j?.id;

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

async function main() {
  // 1) Load current board state (collections[] + files[] live at the response root).
  const { res: gr, json: data } = await api('GET', `/v1/boards/${BOARD}`);
  if (!gr.ok) {
    console.error(`GET board failed: HTTP ${gr.status} ${JSON.stringify(data).slice(0, 300)}`);
    process.exit(1);
  }
  const collections = data.collections || [];
  const files = data.files || [];
  const existingNames = new Set(files.map((f) => f.name));
  console.log(`Board "${data.board?.name || BOARD}": ${files.length} file(s), ${collections.length} collection(s).`);

  // 2) Find-or-create the target collection.
  let collectionId = collections.find((c) => c.name === COLLECTION)?.id;
  if (collectionId) {
    console.log(`Collection "${COLLECTION}" exists (${collectionId}).`);
  } else {
    const { res, json } = await api('POST', `/v1/boards/${BOARD}/collections`, { name: COLLECTION });
    if (!res.ok) {
      console.error(`Create collection failed: HTTP ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
      process.exit(1);
    }
    collectionId = pickId(json);
    console.log(`Created collection "${COLLECTION}" (${collectionId}).`);
  }

  // 3) Create-if-missing for each managed doc.
  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const [rel, name] of DOCS) {
    if (existingNames.has(name)) {
      console.log(`  = skip "${name}" (already on board; API has no update — delete in the UI to refresh)`);
      skipped += 1;
      continue;
    }
    let content;
    try {
      content = readFileSync(join(ROOT, rel), 'utf8');
    } catch (e) {
      console.error(`  x read "${rel}": ${e.message}`);
      failed += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const { res, json } = await api('POST', `/v1/boards/${BOARD}/documents`, {
      name,
      content,
      mimeType: 'text/markdown',
      collectionId,
    });
    if (res.ok) {
      console.log(`  + create "${name}" (${content.length}B) → ${pickId(json)}`);
      created += 1;
    } else {
      console.error(`  x create "${name}": HTTP ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
      failed += 1;
    }
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped, ${failed} failed → collection ${collectionId}`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
