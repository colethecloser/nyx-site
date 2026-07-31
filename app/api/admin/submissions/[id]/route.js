import { queryOne } from '../../../../../lib/db.js';
import { badRequest, fieldErrors, handleError, json, readJson } from '../../../../../lib/api.js';
import { requireAdmin } from '../../../../../lib/session.js';
import { gradeSchema } from '../../../../../lib/schemas.js';
import { recomputePoints } from '../../../../../lib/leaderboard.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Grade a submission. Final points override the provisional award. */
export async function POST(request, { params }) {
  try {
    const admin = await requireAdmin();

    const body = await readJson(request);
    if (!body) return badRequest('Malformed request body');

    const parsed = gradeSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Invalid grade.', fields: fieldErrors(parsed.error) }, { status: 422 });
    }

    const submission = await queryOne(
      `SELECT s.id, s.member_id, m.cohort_id, d.points_value
         FROM submissions s
         JOIN members m ON m.id = s.member_id
         JOIN deliverables d ON d.id = s.deliverable_id
        WHERE s.id = $1`,
      [params.id]
    );
    if (!submission) return json({ error: 'Submission not found.' }, { status: 404 });

    if (parsed.data.points_awarded > submission.points_value) {
      return json(
        { error: `That deliverable is worth at most ${submission.points_value} points.` },
        { status: 422 }
      );
    }

    await queryOne(
      `UPDATE submissions
          SET points_awarded = $2,
              feedback = $3,
              status = 'graded',
              graded_at = now(),
              graded_by = $4,
              updated_at = now()
        WHERE id = $1
        RETURNING id`,
      [params.id, parsed.data.points_awarded, parsed.data.feedback ?? null, admin.email]
    );

    await recomputePoints(submission.cohort_id);

    return json({ ok: true });
  } catch (err) {
    return handleError(err, 'admin.grade');
  }
}
