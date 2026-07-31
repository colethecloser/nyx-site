import { handleError, json } from '../../../../lib/api.js';
import { isAuthorizedCron } from '../../../../lib/auth.js';
import { LOCK_WEEKLY, withAdvisoryLock } from '../../../../lib/db.js';
import { recordRun, runWeekly } from '../../../../lib/jobs.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Monday morning job: publish the week's deliverable, recompute the
 * leaderboard, and mail every member their standing.
 *
 * Vercel Cron issues a GET with `Authorization: Bearer $CRON_SECRET`. Without a
 * matching secret this is a 401 — the endpoint sends real email and must not be
 * triggerable by anyone who guesses the path.
 */
export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { acquired, result } = await withAdvisoryLock(LOCK_WEEKLY, () =>
      recordRun('weekly', runWeekly)
    );

    if (!acquired) return json({ ok: true, skipped: 'another run is in progress' });
    return json({ ok: true, ...result });
  } catch (err) {
    return handleError(err, 'cron.weekly');
  }
}
