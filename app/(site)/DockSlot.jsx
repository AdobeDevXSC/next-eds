'use client';

import {
  createContext, useContext, useMemo, useState,
} from 'react';

// Shell chrome coordination:
// - `action`: a node a page injects into the mobile docked bar, above the global tab bar (Home
//   injects its two CTAs).
// - `chromeless`: a focused flow (the builder) sets this true so AppShell hides its default
//   header and docked tab bar; that page renders its own header + docked action bar instead.

const DockSlotContext = createContext(null);

export function DockSlotProvider({ children }) {
  const [action, setAction] = useState(null);
  const [chromeless, setChromeless] = useState(false);
  const value = useMemo(
    () => ({
      action, setAction, chromeless, setChromeless,
    }),
    [action, chromeless],
  );
  return <DockSlotContext.Provider value={value}>{children}</DockSlotContext.Provider>;
}

export function useDockSlot() {
  const ctx = useContext(DockSlotContext);
  if (!ctx) throw new Error('useDockSlot must be used within a DockSlotProvider');
  return ctx;
}
