'use client';

import {
  createContext, useContext, useEffect, useMemo, useState, useCallback,
} from 'react';

// Order store backed by the server/KV cart (/api/cart). Keeps the same useOrder() shape it had
// as a localStorage store, so every consumer is unchanged. Mutations POST/PATCH/DELETE and set
// the returned items (server is source of truth). pickupTime is ephemeral client state.

const OrderContext = createContext(null);

async function cartFetch(method, body) {
  const res = await fetch('/api/cart', {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error('cart request failed');
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export function OrderProvider({ children }) {
  const [items, setItems] = useState([]);
  const [pickupTime, setPickupTime] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/cart')
      .then((r) => r.json())
      .then((d) => { if (live) setItems(Array.isArray(d.items) ? d.items : []); })
      .catch(() => { /* keep empty */ })
      .finally(() => { if (live) setHydrated(true); });
    return () => { live = false; };
  }, []);

  const addToOrder = useCallback(({ name, unitPriceCents }) => {
    setItems((prev) => {
      // optimistic: mirror the server's add/increment
      const idx = prev.findIndex((i) => i.name === name && i.unitPriceCents === unitPriceCents);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [...prev, { id: `tmp-${Date.now()}`, name, unitPriceCents, qty: 1 }];
    });
    cartFetch('POST', { name, unitPriceCents }).then(setItems).catch(() => {});
  }, []);

  const setQty = useCallback((id, qty) => {
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.id !== id)
      : prev.map((i) => (i.id === id ? { ...i, qty } : i))));
    cartFetch('PATCH', { id, qty }).then(setItems).catch(() => {});
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    cartFetch('DELETE', { id }).then(setItems).catch(() => {});
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    cartFetch('DELETE', null).then(setItems).catch(() => {});
  }, []);

  const value = useMemo(() => ({
    items,
    orderCount: items.reduce((s, i) => s + i.qty, 0),
    orderTotalCents: items.reduce((s, i) => s + i.unitPriceCents * i.qty, 0),
    pickupTime,
    hydrated,
    addToOrder,
    setQty,
    remove,
    clear,
    setPickupTime,
  }), [items, pickupTime, hydrated, addToOrder, setQty, remove, clear]);

  return <OrderContext.Provider value={value}>{children}</OrderContext.Provider>;
}

export function useOrder() {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useOrder must be used within an OrderProvider');
  return ctx;
}
