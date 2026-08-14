import { getCloudflareContext } from '@opennextjs/cloudflare';

// D1 access for Stacked's persistence (users, saved sandwiches, orders, loyalty). See
// docs/superpowers/specs/2026-08-13-stacked-demo-design.md §4.2 for the schema and
// migrations/0001_schema.sql for the DDL. Only callable inside an active Next.js request
// (Route Handler or Server Component) — getCloudflareContext() has no meaning outside one.

/** @returns {import('@cloudflare/workers-types').D1Database} */
export function getDb() {
  return getCloudflareContext().env.DB;
}

/**
 * @param {string} id
 * @returns {Promise<{id:string,name:string,email:string|null,avatar_initials:string,
 *   is_demo:number,loyalty_stamps:number,created_at:string}|null>}
 */
export async function getUserById(id) {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
}

/**
 * The demo sign-in list: every seeded persona, ordered for a stable UI.
 * @returns {Promise<{id:string,name:string,avatar_initials:string,loyalty_stamps:number}[]>}
 */
export async function getPersonas() {
  const { results } = await getDb()
    .prepare('SELECT id, name, avatar_initials, loyalty_stamps FROM users WHERE is_demo = 1 ORDER BY id')
    .all();
  return results;
}
