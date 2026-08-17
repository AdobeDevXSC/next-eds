'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useDockSlot } from '../DockSlot.jsx';

// Injects the home's two CTAs into the mobile docked action row (the docked bar is hidden on
// desktop, where the CTAs render inline in the hero instead). See README 3a docked bar.
export default function HomeDockCtas({
  shopHref, shopLabel, buildHref, buildLabel,
}) {
  const { setAction } = useDockSlot();
  useEffect(() => {
    setAction(
      <div className="home-dock-ctas">
        <Link href={shopHref} className="btn btn-primary home-dock-btn">{shopLabel}</Link>
        <Link href={buildHref} className="btn btn-ghost home-dock-btn">{buildLabel}</Link>
      </div>,
    );
    return () => setAction(null);
  }, [setAction, shopHref, shopLabel, buildHref, buildLabel]);
  return null;
}
