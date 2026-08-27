'use client';

import { useOrder } from '../../lib/order/OrderProvider.jsx';

// Self-contained copy of app/(site)/home/PickAddButton.jsx's add-to-order logic, for the
// todays-pick RSC island (./TodaysPick.jsx). Duplicated intentionally rather than imported —
// app/(site)/home/ is deleted by a later task in this refactor (see
// docs/architecture/blocks-and-rsc.md).

function toCents(display) {
  const n = parseFloat(String(display).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// Mobile-only "Add to order" on Today's picks. Appends the pick to the cart via useOrder(); the
// tab badge reflects the new count. Hidden on desktop by todays-pick.css's .pick-add (desktop's
// pick-card has no add button, matching the original design).
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
