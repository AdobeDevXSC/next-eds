import { cookies } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Cart in KV, keyed by whichever identity is active: a signed-in user's id, or a guest cart
// cookie for an anonymous visitor. On sign-in, mergeGuestCartIntoUser folds the guest cart
// into the user's cart and clears the guest cookie. See
// docs/superpowers/specs/2026-08-13-stacked-demo-design.md §4.3.

export const CART_COOKIE = 'stacked_cart';
const CART_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getKv() {
  return getCloudflareContext().env.APP_KV;
}

/** Read the guest cart cookie without creating one (used by the merge step, which must not
 * mint a fresh empty guest cart just to look for one). @returns {Promise<string|null>} */
async function readGuestCartId() {
  const jar = await cookies();
  return jar.get(CART_COOKIE)?.value ?? null;
}

/** Read the guest cart cookie, creating and setting one if the visitor doesn't have one yet.
 * Only call this from a Route Handler (or other context where cookies() is mutable) — Server
 * Components may only read cookies. @returns {Promise<string>} */
async function getOrCreateGuestCartId() {
  const jar = await cookies();
  let id = jar.get(CART_COOKIE)?.value;
  if (!id) {
    id = crypto.randomUUID();
    jar.set(CART_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: CART_COOKIE_MAX_AGE_SECONDS,
      path: '/',
    });
  }
  return id;
}

/**
 * @param {{id:string}|null} user
 * @returns {Promise<string>} the KV key for this identity's cart
 */
export async function getCartKey(user) {
  return user ? `cart:${user.id}` : `cart:${await getOrCreateGuestCartId()}`;
}

/**
 * @param {{id:string}|null} user
 * @returns {Promise<Array>} the cart's line items, or [] if empty/never created
 */
export async function getCart(user) {
  const raw = await getKv().get(await getCartKey(user));
  return raw ? JSON.parse(raw) : [];
}

/**
 * @param {{id:string}|null} user
 * @param {Array} items
 */
export async function saveCart(user, items) {
  await getKv().put(await getCartKey(user), JSON.stringify(items));
}

/** Fold a guest's cart (if any) into the just-signed-in user's cart, then clear the guest
 * cookie. Appends guest items after the user's existing items; a no-op if there is no guest
 * cart cookie or it points at an empty/missing cart.
 * @param {string} userId
 */
export async function mergeGuestCartIntoUser(userId) {
  const guestId = await readGuestCartId();
  if (!guestId) return;

  const kv = getKv();
  const guestRaw = await kv.get(`cart:${guestId}`);
  if (guestRaw) {
    const guestItems = JSON.parse(guestRaw);
    const userRaw = await kv.get(`cart:${userId}`);
    const userItems = userRaw ? JSON.parse(userRaw) : [];
    await kv.put(`cart:${userId}`, JSON.stringify([...userItems, ...guestItems]));
    await kv.delete(`cart:${guestId}`);
  }

  const jar = await cookies();
  jar.delete(CART_COOKIE);
}
