import { queryOne } from '../../../lib/db.js';
import { badRequest, handleError, json, readJson } from '../../../lib/api.js';
import { clientIp, hashToken } from '../../../lib/auth.js';
import { rateLimit } from '../../../lib/ratelimit.js';
import { createCheckoutSession } from '../../../lib/stripe.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Turn an accept-invite into a Stripe Checkout session.
 *
 * The invite token is the *only* thing that authorizes payment: it is looked up
 * by hash, must be unused, unexpired, and attached to an application still in
 * `accepted`. That keeps checkout genuinely application-gated rather than
 * "anyone who finds the price".
 */
export async function POST(request) {
  try {
    const limited = await rateLimit({
      key: `checkout:${clientIp(request)}`,
      limit: 10,
      windowSeconds: 600,
    });
    if (!limited.ok) return json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });

    const body = await readJson(request);
    const token = body?.token;
    if (!token || typeof token !== 'string') return badRequest('Missing invite token');

    const application = await queryOne(
      `SELECT * FROM applications
        WHERE invite_token_hash = $1
          AND status = 'accepted'
          AND invite_used_at IS NULL
          AND invite_expires_at > now()`,
      [hashToken(token)]
    );

    if (!application) {
      return json(
        { error: 'This invite is no longer valid. It may have expired or already been used.' },
        { status: 404 }
      );
    }

    const cohort = await queryOne(`SELECT * FROM cohorts WHERE id = $1`, [application.cohort_id]);
    if (!cohort) return json({ error: 'Cohort not found.' }, { status: 404 });

    const session = await createCheckoutSession({ application, cohort, inviteToken: token });
    return json({ url: session.url });
  } catch (err) {
    return handleError(err, 'checkout.POST');
  }
}
