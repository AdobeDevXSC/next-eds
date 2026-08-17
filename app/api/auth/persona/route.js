import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserById } from '../../../../lib/db.js';
import { createSession, SESSION_COOKIE } from '../../../../lib/session.js';
import { mergeGuestCartIntoUser } from '../../../../lib/cart.js';

const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

// One-click demo sign-in: POST { personaId } (or a form field of the same name) -> verify the
// persona exists, create a KV session, merge any guest cart into it, set the session cookie,
// and redirect. See docs/superpowers/specs/2026-08-13-stacked-demo-design.md §5.
export async function POST(request) {
  let personaId;
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    ({ personaId } = await request.json());
  } else {
    const form = await request.formData();
    personaId = form.get('personaId');
  }

  const user = personaId ? await getUserById(String(personaId)) : null;
  if (!user || !user.is_demo) {
    return NextResponse.json({ error: 'Unknown persona' }, { status: 400 });
  }

  const sessionId = await createSession(user.id);
  await mergeGuestCartIntoUser(user.id);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });

  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
