import { queryOne } from './db.js';
import { provisionalPoints } from './deliverables.js';
import { recomputePoints } from './leaderboard.js';

export class SubmissionError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = 'SubmissionError';
    this.status = status;
  }
}

/**
 * Create or edit a member's submission for a deliverable.
 *
 * The rule that matters: **credit is fixed by the first submission.** Status and
 * points are written on insert and never touched again on update, so fixing a
 * typo after the deadline cannot silently halve an on-time score. Grading is the
 * only thing that changes points afterwards, and a graded row is frozen.
 */
export async function saveSubmission({ member, deliverable, url, notes }) {
  const existing = await queryOne(
    `SELECT id, status, points_awarded FROM submissions
      WHERE deliverable_id = $1 AND member_id = $2`,
    [deliverable.id, member.id]
  );

  if (existing?.status === 'graded') {
    throw new SubmissionError('This week has already been graded and can no longer be edited.');
  }

  const { points, status } = provisionalPoints(deliverable);

  const submission = await queryOne(
    `INSERT INTO submissions (deliverable_id, member_id, url, notes, status, points_awarded)
     VALUES ($1, $2, $3, $4, $5::submission_status, $6)
     ON CONFLICT (deliverable_id, member_id) DO UPDATE
       SET url = EXCLUDED.url,
           notes = EXCLUDED.notes,
           updated_at = now()
     RETURNING *`,
    [deliverable.id, member.id, url ?? null, notes, status, points]
  );

  await recomputePoints(member.cohort_id);

  return { submission, created: !existing };
}
