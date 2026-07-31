/**
 * Central environment access.
 *
 * Nothing here throws at import time — the marketing pages must keep building
 * even when the cohort platform's secrets are absent (e.g. a preview deploy).
 * Instead, each consumer calls `requireEnv` at request time and gets a clear
 * error that the route handlers turn into a 503.
 */

export class MissingEnvError extends Error {
  constructor(names) {
    super(`Missing required environment variable(s): ${names.join(', ')}`);
    this.name = 'MissingEnvError';
    this.names = names;
  }
}

export function requireEnv(...names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) throw new MissingEnvError(missing);
  return names.map((n) => process.env[n]);
}

export function optionalEnv(name, fallback = undefined) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Public origin used to build absolute links in emails and Stripe redirects. */
export function siteUrl() {
  const explicit = optionalEnv('NEXT_PUBLIC_SITE_URL');
  if (explicit) return explicit.replace(/\/+$/, '');
  const vercel = optionalEnv('VERCEL_PROJECT_PRODUCTION_URL') || optionalEnv('VERCEL_URL');
  if (vercel) return `https://${vercel.replace(/\/+$/, '')}`;
  return 'http://localhost:3000';
}

/** Emails allowed into /admin. Comma separated, case-insensitive. */
export function adminEmails() {
  return optionalEnv('ADMIN_EMAILS', '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const COHORT_PRICE_CENTS = intEnv('COHORT_PRICE_CENTS', 19900);

/**
 * Static description of the program, used to render the public page when the
 * database has nothing to say — either because no cohort row exists yet or
 * because the database is unreachable.
 *
 * This exists so a fresh deploy is a real marketing site on the first push,
 * before anyone has provisioned Postgres. Live values always win when they are
 * available; these are only the floor.
 */
export const PROGRAM = {
  name: optionalEnv('COHORT_NAME', 'FGCU Finance Cohort'),
  capacity: intEnv('COHORT_CAPACITY', 30),
  weeks: intEnv('COHORT_WEEKS', 8),
  /** ISO date, or null when the next intake has not been scheduled. */
  startsOn: optionalEnv('COHORT_STARTS_ON', null),
};

/**
 * Application scoring thresholds — see lib/applications.js.
 *
 * The gap between them is deliberately wide: only a clearly strong application
 * is auto-accepted and only a clearly non-serious one is auto-declined.
 * Everything in between goes to a human, with the daily sweep as a backstop.
 * `MIN_VIABLE_SCORE` is kept low on purpose — a genuine beginner who answers
 * honestly lands in the mid-30s, and auto-declining them unread is the one
 * mistake this funnel cannot take back.
 */
export const AUTO_ACCEPT_SCORE = intEnv('AUTO_ACCEPT_SCORE', 70);
export const MIN_VIABLE_SCORE = intEnv('MIN_VIABLE_SCORE', 25);
/** Days an application may sit in `under_review` before the cron sweeps it. */
export const REVIEW_SLA_DAYS = intEnv('REVIEW_SLA_DAYS', 3);
