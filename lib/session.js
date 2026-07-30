import { cookies } from 'next/headers';
import {
  AuthError,
  SESSION_COOKIE,
  deleteSession,
  getMemberBySessionToken,
} from './auth.js';

/**
 * The cookie-bound half of auth. Everything here needs a request context, which
 * is why it lives apart from `lib/auth.js` — that module stays importable from
 * plain Node (and therefore from tests).
 */

export async function getCurrentMember() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return getMemberBySessionToken(token);
}

export async function requireMember() {
  const member = await getCurrentMember();
  if (!member) throw new AuthError('Sign in to continue');
  return member;
}

export async function requireAdmin() {
  const member = await requireMember();
  if (!member.isAdmin) throw new AuthError('Admin access required', 403);
  return member;
}

export async function destroySession() {
  await deleteSession(cookies().get(SESSION_COOKIE)?.value);
}
