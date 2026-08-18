import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/session.js';
import { getFlags } from '../../../../lib/flags.js';
import { getDb } from '../../../../lib/db.js';
import { getCart, saveCart } from '../../../../lib/cart.js';

// Simulated order placement. Clears the cart; when signed in and the loyalty flag is on, earns
// one stamp and records the order. Never 500s the client — a persistence error still clears the
// cart and returns ok with stampEarned:false.
export async function POST(request) {
  const user = await getCurrentUser();
  const body = await request.json().catch(() => ({}));
  const pickupTime = body && typeof body.pickupTime === 'string' ? body.pickupTime : '';

  const items = await getCart(user);
  const totalCents = (Array.isArray(items) ? items : [])
    .reduce((s, i) => s + i.unitPriceCents * i.qty, 0);

  let stampEarned = false;
  const flags = await getFlags();
  if (user && flags.loyalty) {
    try {
      const db = getDb();
      await db.prepare('UPDATE users SET loyalty_stamps = loyalty_stamps + 1 WHERE id = ?')
        .bind(user.id).run();
      const orderId = crypto.randomUUID();
      await db.prepare('INSERT INTO orders (id, user_id, status, pickup_time, subtotal_cents) VALUES (?, ?, ?, ?, ?)')
        .bind(orderId, user.id, 'placed', pickupTime, totalCents).run();
      stampEarned = true;
    } catch {
      stampEarned = false;
    }
  }

  await saveCart(user, []);
  return NextResponse.json({
    ok: true, totalCents, pickupTime, stampEarned,
  });
}
