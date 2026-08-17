'use client';

import {
  createContext, useContext, useEffect, useMemo, useState,
} from 'react';

// Client-side order store, persisted to localStorage so an interrupted order survives relaunch
// (per the README's PWA/state model — no backend implied). Holds menu items and composed custom
// stacks; totals are computed locally. See docs/superpowers/specs/2026-08-17-stacked-redesign.md.

const STORAGE_KEY = 'stacked-order-v1';
const OrderContext = createContext(null);

function readStored() {
  if (typeof window === 'undefined') return { items: [], pickupTime: '' };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [], pickupTime: '' };
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      pickupTime: typeof parsed.pickupTime === 'string' ? parsed.pickupTime : '',
    };
  } catch {
    return { items: [], pickupTime: '' };
  }
}

export function OrderProvider({ children }) {
  // Start empty on both server and first client render (avoids hydration mismatch), then hydrate
  // from localStorage after mount.
  const [items, setItems] = useState([]);
  const [pickupTime, setPickupTime] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStored();
    setItems(stored.items);
    setPickupTime(stored.pickupTime);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, pickupTime }));
    } catch {
      // storage full / unavailable — the in-memory order still works this session
    }
  }, [items, pickupTime, hydrated]);

  const value = useMemo(() => {
    const orderCount = items.reduce((sum, i) => sum + i.qty, 0);
    const orderTotalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.qty, 0);

    const addToOrder = ({ name, unitPriceCents }) => setItems((prev) => {
      const idx = prev.findIndex((i) => i.name === name && i.unitPriceCents === unitPriceCents);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { id: `${Date.now()}-${prev.length}`, name, unitPriceCents, qty: 1 }];
    });

    const setQty = (id, qty) => setItems((prev) => (qty <= 0
      ? prev.filter((i) => i.id !== id)
      : prev.map((i) => (i.id === id ? { ...i, qty } : i))));

    const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
    const clear = () => setItems([]);

    return {
      items,
      orderCount,
      orderTotalCents,
      pickupTime,
      hydrated,
      addToOrder,
      setQty,
      remove,
      clear,
      setPickupTime,
    };
  }, [items, pickupTime, hydrated]);

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrder must be used within an OrderProvider');
  return ctx;
}
