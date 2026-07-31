import { handleError, json } from '../../../../lib/api.js';
import { isAuthorizedCron } from '../../../../lib/auth.js';
import { LOCK_DAILY, withAdvisoryLock } from '../../../../lib/db.js';
import { recordRun, runDaily } from '../../../../lib/jobs.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily job: deadline nudges, application-funnel hygiene (expired invites,
 * stale reviews, waitlist promotion), failed-email retries, and pruning.
 */
export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { acquired, result } = await withAdvisoryLock(LOCK_DAILY, () =>
      recordRun('daily', runDaily)
    );

    if (!acquired) return json({ ok: true, skipped: 'another run is in progress' });
    return json({ ok: true, ...result });
  } catch (err) {
    return handleError(err, 'cron.daily');
  }
}
