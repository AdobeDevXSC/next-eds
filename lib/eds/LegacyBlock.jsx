'use client';

import { useEffect, useRef } from 'react';

// Compatibility path for "classic" EDS blocks — a blockname/blockname.js that exports
// decorate(block) plus blockname.css, with no ported .jsx component or registry entry.
//
// The block's semantic markup (block > row > cell divs) is rendered on the SERVER via
// dangerouslySetInnerHTML, so the content is present and indexable even if JS never runs.
// On mount we load the block's stylesheet and run its native decorate() against the real
// DOM node — the same contract aem.js's loadBlock() provides. Because the inner markup is
// injected as raw HTML, React treats the subtree as opaque and never reconciles it, so the
// imperative DOM mutations decorate() makes are safe.
export default function LegacyBlock({ name, variants = [], rows = [] }) {
  const ref = useRef(null);
  const decorated = useRef(false);

  useEffect(() => {
    if (decorated.current) return undefined; // guard double-invoke (StrictMode / remount)
    const block = ref.current;
    if (!block) return undefined;
    decorated.current = true;

    // aem.js seeds these before decoration; a few blocks read window.hlx.codeBasePath.
    window.hlx = window.hlx || {};
    if (window.hlx.codeBasePath === undefined) window.hlx.codeBasePath = '';

    let cancelled = false;
    (async () => {
      try {
        // Name-keyed dynamic imports: the bundler compiles /blocks/*/*.{css,js} into one
        // lazy chunk per block, so dropping in a new classic block needs no registration.
        await import(`../../blocks/${name}/${name}.css`).catch(() => {});
        const mod = await import(`../../blocks/${name}/${name}.js`);
        if (cancelled) return;
        block.dataset.blockStatus = 'loading';
        await mod.default?.(block);
        block.dataset.blockStatus = 'loaded';
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`LegacyBlock: failed to load/decorate "${name}"`, err);
      }
    })();

    return () => { cancelled = true; };
  }, [name]);

  const className = [name, ...variants, 'block'].join(' ');
  // Reproduce the EDS block grid: each row is a <div>, each cell a nested <div>.
  const inner = rows
    .map((cells) => `<div>${cells.map((cell) => `<div>${cell.html}</div>`).join('')}</div>`)
    .join('');

  return (
    <div className={`${name}-wrapper`}>
      <div
        ref={ref}
        className={className}
        data-block-name={name}
        data-block-status="initialized"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: inner }}
      />
    </div>
  );
}
