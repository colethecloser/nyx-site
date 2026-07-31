import { NextResponse } from 'next/server';
import { queryOne, query } from '../../../../lib/db.js';
import { consumeLoginToken, createSession, sessionCookieOptions, SESSION_COOKIE } from '../../../../lib/auth.js';
import { handleError } from '../../../../lib/api.js';
import { siteUrl } from '../../../../lib/env.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Magic-link landing. This has to be a GET because it is opened from an email
 * client, so the token is strictly single-use and short-lived — see
 * `consumeLoginToken`, where the UPDATE ... WHERE used_at IS NULL is what makes
 * a second click (or a link-prefetching mail scanner) fail closed.
 */
export async function GET(request) {
  try {
    const token = new URL(request.url).searchParams.get('token');
    const email = await consumeLoginToken(token);

    if (!email) {
      return NextResponse.redirect(`${siteUrl()}/login?error=expired`, { status: 303 });
    }

    const member = await queryOne(`SELECT id FROM members WHERE email = $1`, [email]);
    if (!member) {
      return NextResponse.redirect(`${siteUrl()}/login?error=unknown`, { status: 303 });
    }

    const sessionToken = await createSession(member.id, request.headers.get('user-agent'));
    await query(`UPDATE members SET last_seen_at = now() WHERE id = $1`, [member.id]);

    const response = NextResponse.redirect(`${siteUrl()}/dashboard`, { status: 303 });
    response.cookies.set(SESSION_COOKIE, sessionToken, sessionCookieOptions());
    return response;
  } catch (err) {
    return handleError(err, 'auth.verify');
  }
}
