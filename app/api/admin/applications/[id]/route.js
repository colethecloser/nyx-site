import { queryOne } from '../../../../../lib/db.js';
import { badRequest, fieldErrors, handleError, json, readJson } from '../../../../../lib/api.js';
import { requireAdmin } from '../../../../../lib/session.js';
import { decisionSchema } from '../../../../../lib/schemas.js';
import { decide, seatCounts, sendDecisionEmail } from '../../../../../lib/applications.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Manual override of the auto-vetter. Emails the applicant either way. */
export async function POST(request, { params }) {
  try {
    const admin = await requireAdmin();

    const body = await readJson(request);
    if (!body) return badRequest('Malformed request body');

    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Invalid decision.', fields: fieldErrors(parsed.error) }, { status: 422 });
    }

    const application = await queryOne(`SELECT id, cohort_id FROM applications WHERE id = $1`, [
      params.id,
    ]);
    if (!application) return json({ error: 'Application not found.' }, { status: 404 });

    let result;
    try {
      result = await decide({
        applicationId: params.id,
        status: parsed.data.status,
        decidedBy: admin.email,
        reason: parsed.data.reason ?? null,
      });
    } catch (err) {
      // decide() refuses illegal transitions (e.g. re-deciding an enrolled
      // applicant); surface that as a 409 rather than a 500.
      return json({ error: err.message }, { status: 409 });
    }

    if (!result.changed) {
      return json({ ok: true, status: parsed.data.status, unchanged: true });
    }

    const cohort = await queryOne(`SELECT * FROM cohorts WHERE id = $1`, [application.cohort_id]);
    const { seatsLeft } = await seatCounts(application.cohort_id);

    await sendDecisionEmail({
      application: result.application,
      inviteToken: result.inviteToken,
      cohort,
      seatsLeft,
    }).catch((err) => console.error('[admin] decision email failed:', err.message));

    return json({ ok: true, status: result.application.status });
  } catch (err) {
    return handleError(err, 'admin.decision');
  }
}
