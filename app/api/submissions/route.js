import { badRequest, fieldErrors, handleError, json, readJson } from '../../../lib/api.js';
import { hasAccess } from '../../../lib/auth.js';
import { requireMember } from '../../../lib/session.js';
import { submissionSchema } from '../../../lib/schemas.js';
import { getDeliverable } from '../../../lib/deliverables.js';
import { SubmissionError, saveSubmission } from '../../../lib/submissions.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const member = await requireMember();
    if (!hasAccess(member)) {
      return json({ error: 'Your membership is not active.' }, { status: 402 });
    }

    const body = await readJson(request);
    if (!body) return badRequest('Malformed request body');

    const parsed = submissionSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Please fix the highlighted fields.', fields: fieldErrors(parsed.error) }, { status: 422 });
    }
    const { deliverable_id: deliverableId, url, notes } = parsed.data;

    const deliverable = await getDeliverable(deliverableId);
    // Same 404 for "does not exist", "not yours", and "not published yet" — a
    // member should not be able to probe another cohort's schedule.
    if (!deliverable || deliverable.cohort_id !== member.cohort_id || !deliverable.published_at) {
      return json({ error: 'Deliverable not found.' }, { status: 404 });
    }

    const { submission, created } = await saveSubmission({ member, deliverable, url, notes });

    return json(
      {
        submission,
        points_awarded: submission.points_awarded,
        status: submission.status,
      },
      { status: created ? 201 : 200 }
    );
  } catch (err) {
    if (err instanceof SubmissionError) {
      return json({ error: err.message }, { status: err.status });
    }
    return handleError(err, 'submissions.POST');
  }
}
