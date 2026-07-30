import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '../../../../lib/auth.js';
import { destroySession } from '../../../../lib/session.js';
import { handleError } from '../../../../lib/api.js';
import { siteUrl } from '../../../../lib/env.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await destroySession();
    const response = NextResponse.redirect(`${siteUrl()}/login`, { status: 303 });
    response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
    return response;
  } catch (err) {
    return handleError(err, 'auth.logout');
  }
}
