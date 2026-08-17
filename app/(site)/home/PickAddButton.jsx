'use client';

import { useOrder } from '../../../lib/order/OrderProvider.jsx';

function toCents(display) {
  const n = parseFloat(String(display).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// Mobile-only "Add to order" on Today's picks (3a). Appends the pick to the local order; the tab
// badge reflects the new count. Hidden on desktop (2a card has no add button).
export default function PickAddButton({ name, priceDisplay, label }) {
  const { addToOrder } = useOrder();
  return (
    <button
      type="button"
      className="btn btn-ghost pick-add"
      onClick={() => addToOrder({ name, unitPriceCents: toCents(priceDisplay) })}
    >
      {label}
    </button>
  );
}
