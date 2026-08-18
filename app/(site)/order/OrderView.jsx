'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useOrder } from '../../../lib/order/OrderProvider.jsx';

const PICKUP_TIMES = ['11:30 AM', '11:45 AM', '12:00 PM', '12:15 PM', '12:30 PM', '12:45 PM', '1:00 PM'];

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function OrderView() {
  const {
    items, orderTotalCents, setQty, remove, clear, pickupTime, setPickupTime, hydrated,
  } = useOrder();
  const [placed, setPlaced] = useState(null);

  // Avoid an empty-state flash before localStorage hydrates.
  if (!hydrated) {
    return <main className="order"><div className="order-inner" /></main>;
  }

  if (placed) {
    return (
      <main className="order">
        <div className="order-inner">
          <h1 className="order-title">Order placed</h1>
          <p className="order-confirm">
            {`Thanks! Your order is in — pickup at ${placed.pickupTime || 'the counter'}. Total ${money(placed.total)}.`}
          </p>
          <Link href="/" className="btn btn-ghost order-again">Back to home</Link>
        </div>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="order">
        <div className="order-inner">
          <h1 className="order-title">Your order</h1>
          <p className="order-empty">Nothing here yet. Shop the menu or build your own stack.</p>
          <div className="order-empty-ctas">
            <Link href="/menu" className="btn btn-primary">Shop the menu</Link>
            <Link href="/build" className="btn btn-ghost">Build your own</Link>
          </div>
        </div>
      </main>
    );
  }

  const placeOrder = async () => {
    const total = orderTotalCents;
    try {
      await fetch('/api/order/place', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pickupTime }),
      });
    } catch {
      // simulated placement still succeeds for the demo
    }
    setPlaced({ total, pickupTime });
    clear();
  };

  return (
    <main className="order">
      <div className="order-inner">
        <h1 className="order-title">Your order</h1>

        <ul className="order-items">
          {items.map((item) => (
            <li className="order-item" key={item.id}>
              <div className="order-item-main">
                <span className="order-item-name">{item.name}</span>
                <span className="order-item-price">{money(item.unitPriceCents * item.qty)}</span>
              </div>
              <div className="order-item-controls">
                <div className="qty">
                  <button type="button" className="qty-btn" aria-label="Decrease quantity" onClick={() => setQty(item.id, item.qty - 1)}>−</button>
                  <span className="qty-val">{item.qty}</span>
                  <button type="button" className="qty-btn" aria-label="Increase quantity" onClick={() => setQty(item.id, item.qty + 1)}>+</button>
                </div>
                <button type="button" className="order-remove" onClick={() => remove(item.id)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>

        <div className="order-pickup">
          <span className="order-pickup-label">Pickup time</span>
          <div className="order-pickup-times">
            {PICKUP_TIMES.map((t) => (
              <button
                key={t}
                type="button"
                className={`pickup-chip${pickupTime === t ? ' pickup-chip-on' : ''}`}
                aria-pressed={pickupTime === t}
                onClick={() => setPickupTime(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="order-summary">
          <span className="order-summary-label">Total</span>
          <span className="order-summary-total">{money(orderTotalCents)}</span>
        </div>

        <button type="button" className="btn btn-primary order-place" onClick={placeOrder}>
          Place order
        </button>
      </div>
    </main>
  );
}
