'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { parse } from 'node-html-parser';
import { useDockSlot } from '../../app/(site)/DockSlot.jsx';
import './dock-ctas.css';

// Dock CTAs — Tier-2 RSC island (registered in lib/registry.js; see
// docs/architecture/blocks-and-rsc.md). Needs useDockSlot() app state, so it renders only in the
// Next app and is intentionally absent on raw EDS. It renders nothing in place: it pushes its
// markup into the mobile docked action row (app/(site)/AppShell.jsx's .docked-action), which
// AppShell/shell.css hides entirely on desktop — where the hero renders its own inline CTAs
// instead.
//
// Content model: 2 rows, one per CTA, each [label, href]. Row order is button order: row 0
// renders as the primary button, row 1 as the ghost button (matches blocks/hero-stack's CTA-pair
// convention of first link primary, second ghost).
//
// Self-contained: does not import from app/(site)/home/ (a later task deletes that directory).
// Replicates the small useDockSlot()-in-a-useEffect logic from
// app/(site)/home/HomeDockCtas.jsx.

function cellText(cell) {
  return cell?.html ? parse(cell.html).textContent.trim() : '';
}

// A CTA href cell may be authored as a real link, or as a plain-text path (e.g. "/menu") — same
// defensive pattern as blocks/two-ways/two-ways.js's readHref.
function readHref(cell) {
  if (!cell?.html) return '#';
  const root = parse(cell.html);
  const link = root.querySelector('a');
  if (link) return link.getAttribute('href') || '#';
  return root.textContent.trim() || '#';
}

export default function DockCtas({ rows = [] }) {
  const { setAction } = useDockSlot();
  const [primaryCells, secondaryCells] = rows;
  const primaryLabel = cellText(primaryCells?.[0]);
  const primaryHref = readHref(primaryCells?.[1]);
  // Only 1 row authored → render just the primary; don't push an empty-label ghost button.
  const hasSecondary = Boolean(secondaryCells);
  const secondaryLabel = cellText(secondaryCells?.[0]);
  const secondaryHref = readHref(secondaryCells?.[1]);

  useEffect(() => {
    setAction(
      <div className="dock-ctas">
        <Link href={primaryHref} className="btn btn-primary dock-cta-btn">{primaryLabel}</Link>
        {hasSecondary && (
          <Link href={secondaryHref} className="btn btn-ghost dock-cta-btn">{secondaryLabel}</Link>
        )}
      </div>,
    );
    return () => setAction(null);
  }, [setAction, primaryLabel, primaryHref, hasSecondary, secondaryLabel, secondaryHref]);

  return null;
}
