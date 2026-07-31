import { Pool } from 'pg';
import { requireEnv } from './env.js';

/**
 * A single pooled connection, cached on globalThis so Next's dev-mode module
 * reloading and serverless warm invocations reuse it instead of leaking pools.
 */
const globalForDb = globalThis;

function createPool() {
  const [connectionString] = requireEnv('DATABASE_URL');
  const needsSsl = !/localhost|127\.0\.0\.1/.test(connectionString) &&
    !/sslmode=disable/.test(connectionString);
  return new Pool({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: true } : false,
    max: Number.parseInt(process.env.PGPOOL_MAX || '5', 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getPool() {
  if (!globalForDb.__cohortPool) {
    globalForDb.__cohortPool = createPool();
    // A pool-level error (e.g. server restart) would otherwise crash the process.
    globalForDb.__cohortPool.on('error', (err) => {
      console.error('[db] idle client error', err.message);
    });
  }
  return globalForDb.__cohortPool;
}

export function query(text, params) {
  return getPool().query(text, params);
}

/** Convenience: first row or null. */
export async function queryOne(text, params) {
  const { rows } = await query(text, params);
  return rows[0] ?? null;
}

/** Run `fn` inside a transaction, rolling back on any throw. */
export async function transaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[db] rollback failed', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Session-scoped advisory lock so overlapping cron invocations (Vercel can
 * retry, and a slow run can still be in flight at the next tick) do not double
 * process. Returns false immediately when another run holds the lock.
 */
export async function withAdvisoryLock(key, fn) {
  const client = await getPool().connect();
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [key]);
    if (!rows[0].locked) return { acquired: false, result: null };
    try {
      const result = await fn(client);
      return { acquired: true, result };
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [key]);
    }
  } finally {
    client.release();
  }
}

/** Stable 64-bit-ish lock ids for the cron jobs. */
export const LOCK_WEEKLY = 918_452_001;
export const LOCK_DAILY = 918_452_002;
