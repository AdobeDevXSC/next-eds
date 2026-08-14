import { cookies } from 'next/headers';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getUserById } from './db.js';

// Session cookie <-> KV lookup. session:<id> -> { userId, expiresAt } (see
// docs/superpowers/specs/2026-08-13-stacked-demo-design.md §4.3 / §5). KV's own
// expirationTtl does the real garbage collection; expiresAt is carried in the value too so
// app code can read freshness without a separate metadata call.

export const SESSION_COOKIE = 'stacked_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getKv() {
  return getCloudflareContext().env.APP_KV;
}

/**
 * @param {string} userId
 * @returns {Promise<string>} the new session id
 */
export async function createSession(userId) {
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  await getKv().put(`session:${sessionId}`, JSON.stringify({ userId, expiresAt }), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return sessionId;
}

/** @param {string} sessionId */
export async function destroySession(sessionId) {
  if (!sessionId) return;
  await getKv().delete(`session:${sessionId}`);
}

/** @returns {Promise<string|null>} */
export async function getSessionIdFromCookies() {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

/** Resolve the signed-in user from the session cookie, or null for a guest. Safe to call from
 * a Server Component (read-only cookie access) or a Route Handler.
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
  const sessionId = await getSessionIdFromCookies();
  if (!sessionId) return null;
  const raw = await getKv().get(`session:${sessionId}`);
  if (!raw) return null;
  const { userId } = JSON.parse(raw);
  return getUserById(userId);
}
