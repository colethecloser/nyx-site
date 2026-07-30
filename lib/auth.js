import crypto from 'node:crypto';
import { query, queryOne } from './db.js';
import { adminEmails, intEnv } from './env.js';

export const SESSION_COOKIE = 'cohort_session';
const SESSION_TTL_DAYS = intEnv('SESSION_TTL_DAYS', 30);
const LOGIN_TOKEN_TTL_MINUTES = intEnv('LOGIN_TOKEN_TTL_MINUTES', 30);

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/** Opaque 32-byte token; only its SHA-256 is ever stored. */
export function newToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Constant-time string compare that tolerates length mismatch. */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so the failure isn't distinguishable by timing.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---------------------------------------------------------------------------
// Magic links
// ---------------------------------------------------------------------------

export async function createLoginToken(email) {
  const { token, hash } = newToken();
  await query(
    `INSERT INTO login_tokens (email, token_hash, expires_at)
     VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
    [email, hash, String(LOGIN_TOKEN_TTL_MINUTES)]
  );
  return token;
}

/**
 * Redeem a login token. The UPDATE is the atomic guard: only one caller can
 * flip `used_at` from NULL, so a link that leaks from an inbox cannot be
 * replayed after the member has already used it.
 */
export async function consumeLoginToken(token) {
  if (!token) return null;
  const row = await queryOne(
    `UPDATE login_tokens
        SET used_at = now()
      WHERE token_hash = $1
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING email`,
    [hashToken(token)]
  );
  return row?.email ?? null;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession(memberId, userAgent) {
  const { token, hash } = newToken();
  await query(
    `INSERT INTO sessions (member_id, token_hash, expires_at, user_agent)
     VALUES ($1, $2, now() + ($3 || ' days')::interval, $4)`,
    [memberId, hash, String(SESSION_TTL_DAYS), (userAgent ?? '').slice(0, 300)]
  );
  return token;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}

/**
 * Resolve a member from a raw session token. Cookie handling deliberately lives
 * in `lib/session.js` so this module stays free of `next/headers` and can be
 * exercised directly by tests.
 */
export async function getMemberBySessionToken(token) {
  if (!token) return null;

  const member = await queryOne(
    `SELECT m.*, c.name AS cohort_name, c.slug AS cohort_slug, c.starts_on AS cohort_starts_on
       FROM sessions s
       JOIN members m ON m.id = s.member_id
       JOIN cohorts c ON c.id = m.cohort_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()`,
    [hashToken(token)]
  );
  if (!member) return null;

  return { ...member, isAdmin: computeIsAdmin(member) };
}

export async function deleteSession(token) {
  if (!token) return;
  await query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

function computeIsAdmin(member) {
  if (member.is_admin) return true;
  return adminEmails().includes(String(member.email).toLowerCase());
}

// ---------------------------------------------------------------------------
// Access gating
// ---------------------------------------------------------------------------

/**
 * `past_due` intentionally keeps access: Stripe is still retrying the card and
 * locking someone out mid-dunning is both hostile and bad for recovery rates.
 * Access is only cut once Stripe gives up and the subscription goes canceled or
 * unpaid.
 */
export const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];

export function hasAccess(member) {
  return Boolean(member) && ACTIVE_STATUSES.includes(member.sub_status);
}

/** Verifies the `Authorization: Bearer <CRON_SECRET>` header Vercel Cron sends. */
export function isAuthorizedCron(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') || '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;
  return safeEqual(header.slice(prefix.length), secret);
}

/** Best-effort client IP for rate limiting. */
export function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
