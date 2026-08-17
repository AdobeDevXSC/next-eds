'use client';

import {
  createContext, useContext, useMemo, useState,
} from 'react';

// Lets a page inject an action-row into the mobile docked bar (above the global tab bar) without
// duplicating the tab bar. Home injects its two CTAs; the builder injects the running total +
// "Add to order". Pages that inject nothing show just the tab bar.

const DockSlotContext = createContext(null);

export function DockSlotProvider({ children }) {
  const [action, setAction] = useState(null);
  const value = useMemo(() => ({ action, setAction }), [action]);
  return <DockSlotContext.Provider value={value}>{children}</DockSlotContext.Provider>;
}

export function useDockSlot() {
  const ctx = useContext(DockSlotContext);
  if (!ctx) throw new Error('useDockSlot must be used within a DockSlotProvider');
  return ctx;
}
