import { handleError, json } from '../../../lib/api.js';
import { isInitialised, runSetup } from '../../../lib/bootstrap.js';
import { adminEmails } from '../../../lib/env.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * First-run installer.
 *
 * Guarded by being first-run-only: once a cohort exists this refuses, so the
 * route cannot be used to re-seed or to mint operator links on a live site.
 * Operators can only be created for addresses already in ADMIN_EMAILS, and the
 * link it returns still requires control of that mailbox to use — so the worst
 * an early visitor could do is press a button the owner was about to press.
 */
export async function POST() {
  try {
    if (!adminEmails().length) {
      return json(
        { error: 'Set ADMIN_EMAILS first — otherwise there is nobody to make an operator.' },
        { status: 400 }
      );
    }

    const state = await isInitialised().catch(() => null);
    if (state === null) {
      return json(
        { error: 'Cannot reach the database. Check DATABASE_URL and redeploy.' },
        { status: 503 }
      );
    }
    if (state.cohort) {
      return json(
        { error: 'Already set up. Sign in at /login.' },
        { status: 409 }
      );
    }

    const result = await runSetup();
    return json(result);
  } catch (err) {
    return handleError(err, 'setup.POST');
  }
}
