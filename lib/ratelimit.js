import { query, queryOne } from './db.js';

/**
 * Fixed-window counter in Postgres. Not distributed-perfect, but this is an
 * application form and a magic-link endpoint — the goal is to stop trivial
 * abuse and inbox bombing, not to survive a botnet.
 *
 * Returns `{ ok, count, limit }`. Fails *open* on a DB error: a rate limiter
 * outage must not take down the ability to apply.
 */
export async function rateLimit({ key, limit, windowSeconds }) {
  try {
    const row = await queryOne(
      `INSERT INTO rate_limits (bucket, window_start, count)
       VALUES ($1, to_timestamp(floor(extract(epoch FROM now()) / $2) * $2), 1)
       ON CONFLICT (bucket, window_start)
       DO UPDATE SET count = rate_limits.count + 1
       RETURNING count`,
      [key, windowSeconds]
    );
    const count = row?.count ?? 0;
    return { ok: count <= limit, count, limit };
  } catch (err) {
    console.error('[ratelimit] failing open:', err.message);
    return { ok: true, count: 0, limit };
  }
}

/** Drop windows older than a day. Called from the daily cron. */
export async function pruneRateLimits() {
  const { rowCount } = await query(
    `DELETE FROM rate_limits WHERE window_start < now() - INTERVAL '1 day'`
  );
  return rowCount;
}
