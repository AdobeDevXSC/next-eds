import { NextResponse } from 'next/server';
import { getCart, saveCart } from '../../../lib/cart.js';
import { getCurrentUser } from '../../../lib/session.js';

// Server/KV cart mutation surface (see lib/cart.js). Resolves identity from the session
// (signed-in user) or the guest cart cookie. Degrades to an empty cart on error — never 500s.

async function currentCart() {
  const user = await getCurrentUser();
  const items = await getCart(user);
  return { user, items: Array.isArray(items) ? items : [] };
}

export async function GET() {
  try {
    const { items } = await currentCart();
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request) {
  const { user, items } = await currentCart();
  const body = await request.json().catch(() => null);
  const name = body && typeof body.name === 'string' ? body.name : null;
  const unitPriceCents = body && Number.isFinite(body.unitPriceCents) ? body.unitPriceCents : null;
  if (!name || unitPriceCents === null) {
    return NextResponse.json({ error: 'Expected { name, unitPriceCents }' }, { status: 400 });
  }
  const idx = items.findIndex((i) => i.name === name && i.unitPriceCents === unitPriceCents);
  if (idx >= 0) {
    items[idx] = { ...items[idx], qty: items[idx].qty + 1 };
  } else {
    items.push({ id: `${Date.now()}-${items.length}`, name, unitPriceCents, qty: 1 });
  }
  await saveCart(user, items);
  return NextResponse.json({ items });
}

export async function PATCH(request) {
  const { user, items } = await currentCart();
  const body = await request.json().catch(() => null);
  const id = body && typeof body.id === 'string' ? body.id : null;
  const qty = body && Number.isFinite(body.qty) ? body.qty : null;
  if (!id || qty === null) {
    return NextResponse.json({ error: 'Expected { id, qty }' }, { status: 400 });
  }
  const next = qty <= 0
    ? items.filter((i) => i.id !== id)
    : items.map((i) => (i.id === id ? { ...i, qty } : i));
  await saveCart(user, next);
  return NextResponse.json({ items: next });
}

export async function DELETE(request) {
  const { user, items } = await currentCart();
  const body = await request.json().catch(() => null);
  const id = body && typeof body.id === 'string' ? body.id : null;
  const next = id ? items.filter((i) => i.id !== id) : [];
  await saveCart(user, next);
  return NextResponse.json({ items: next });
}
