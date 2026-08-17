import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { destroySession, getSessionIdFromCookies, SESSION_COOKIE } from '../../../../lib/session.js';

export async function POST(request) {
  const sessionId = await getSessionIdFromCookies();
  await destroySession(sessionId);

  const jar = await cookies();
  jar.delete(SESSION_COOKIE);

  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
