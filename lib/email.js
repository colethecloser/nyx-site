import { Resend } from 'resend';
import { query, queryOne } from './db.js';
import { optionalEnv, requireEnv } from './env.js';

const globalForResend = globalThis;

function client() {
  if (!globalForResend.__resend) {
    const [key] = requireEnv('RESEND_API_KEY');
    globalForResend.__resend = new Resend(key);
  }
  return globalForResend.__resend;
}

function fromAddress() {
  return optionalEnv('EMAIL_FROM', 'FGCU Finance Cohort <cohort@example.com>');
}

/**
 * Send exactly once.
 *
 * The row in `email_log` is *claimed* before the provider is called, and the
 * claim is guarded by a unique index on `dedupe_key`. Two cron invocations
 * racing on the same reminder therefore produce one email: the loser's INSERT
 * returns no row and it bails out. This is the single mechanism that makes
 * every automated send in this codebase safe to re-run.
 */
export async function sendOnce({ to, template, dedupeKey, subject, html, text }) {
  const claim = await queryOne(
    `INSERT INTO email_log (dedupe_key, template, to_email, subject, payload)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (dedupe_key) DO NOTHING
     RETURNING id`,
    [dedupeKey, template, to, subject, JSON.stringify({ html, text })]
  );

  if (!claim) return { sent: false, reason: 'duplicate' };
  return deliver(claim.id, { to, subject, html, text });
}

async function deliver(logId, { to, subject, html, text }) {
  try {
    const { data, error } = await client().emails.send({
      from: fromAddress(),
      to: [to],
      subject,
      html,
      text,
    });
    if (error) throw new Error(error.message || 'Resend rejected the message');

    await query(
      `UPDATE email_log
          SET status = 'sent', provider_id = $2, sent_at = now(), attempts = attempts + 1,
              error = NULL
        WHERE id = $1`,
      [logId, data?.id ?? null]
    );
    return { sent: true, id: data?.id ?? null };
  } catch (err) {
    // Never let a mail failure take down the request or the cron run: record it
    // and let the retry sweep pick it up.
    await query(
      `UPDATE email_log
          SET status = 'failed', error = $2, attempts = attempts + 1
        WHERE id = $1`,
      [logId, String(err.message).slice(0, 500)]
    );
    console.error(`[email] send failed (${logId}):`, err.message);
    return { sent: false, reason: 'error', error: err.message };
  }
}

/** Re-attempt recent failures. Called by the daily cron. */
export async function retryFailedEmails(limit = 25) {
  const { rows } = await query(
    `SELECT id, to_email, subject, payload
       FROM email_log
      WHERE status = 'failed'
        AND attempts < 4
        AND created_at > now() - INTERVAL '7 days'
      ORDER BY created_at
      LIMIT $1`,
    [limit]
  );

  let recovered = 0;
  for (const row of rows) {
    const payload = row.payload || {};
    const result = await deliver(row.id, {
      to: row.to_email,
      subject: row.subject,
      html: payload.html,
      text: payload.text,
    });
    if (result.sent) recovered += 1;
  }
  return { attempted: rows.length, recovered };
}
