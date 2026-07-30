import { query, queryOne } from './db.js';

/** Late work still counts, at half credit. */
export const LATE_CREDIT = 0.5;

export function provisionalPoints(deliverable, at = new Date()) {
  const late = new Date(deliverable.due_at).getTime() < at.getTime();
  const points = late
    ? Math.floor(deliverable.points_value * LATE_CREDIT)
    : deliverable.points_value;
  return { points, status: late ? 'late' : 'submitted' };
}

/**
 * Flip any deliverable whose publish time has arrived. Returns the rows that
 * *this* call published, so the cron only emails about genuinely new work —
 * the `published_at IS NULL` guard makes a second run a no-op.
 */
export async function publishDue(cohortId) {
  const { rows } = await query(
    `UPDATE deliverables
        SET published_at = now()
      WHERE cohort_id = $1
        AND published_at IS NULL
        AND publish_at <= now()
      RETURNING *`,
    [cohortId]
  );
  return rows;
}

export async function listPublished(cohortId) {
  const { rows } = await query(
    `SELECT * FROM deliverables
      WHERE cohort_id = $1 AND published_at IS NOT NULL
      ORDER BY week_number`,
    [cohortId]
  );
  return rows;
}

/** Published deliverables plus this member's submission, for the dashboard. */
export async function listForMember(memberId, cohortId) {
  const { rows } = await query(
    `SELECT d.*,
            s.id AS submission_id, s.url AS submission_url, s.notes AS submission_notes,
            s.status AS submission_status, s.points_awarded, s.feedback,
            s.submitted_at, s.graded_at
       FROM deliverables d
       LEFT JOIN submissions s ON s.deliverable_id = d.id AND s.member_id = $1
      WHERE d.cohort_id = $2 AND d.published_at IS NOT NULL
      ORDER BY d.week_number DESC`,
    [memberId, cohortId]
  );
  return rows;
}

export async function getDeliverable(id) {
  return queryOne(`SELECT * FROM deliverables WHERE id = $1`, [id]);
}

/**
 * Members who have not submitted for a deliverable that is still open.
 * Drives the "due soon" nudge.
 */
export async function missingSubmissions(deliverableId) {
  const { rows } = await query(
    `SELECT m.id, m.email, m.full_name, m.streak_weeks
       FROM members m
      WHERE m.cohort_id = (SELECT cohort_id FROM deliverables WHERE id = $1)
        AND m.sub_status IN ('active', 'trialing', 'past_due')
        AND NOT EXISTS (
          SELECT 1 FROM submissions s
           WHERE s.deliverable_id = $1 AND s.member_id = m.id
        )`,
    [deliverableId]
  );
  return rows;
}

/** Deliverables whose due date is inside the next `hours` and still open. */
export async function dueWithin(cohortId, hours) {
  const { rows } = await query(
    `SELECT * FROM deliverables
      WHERE cohort_id = $1
        AND published_at IS NOT NULL
        AND due_at > now()
        AND due_at <= now() + ($2 || ' hours')::interval
      ORDER BY due_at`,
    [cohortId, String(hours)]
  );
  return rows;
}

export async function activeMembers(cohortId) {
  const { rows } = await query(
    `SELECT id, email, full_name, points, streak_weeks
       FROM members
      WHERE cohort_id = $1 AND sub_status IN ('active', 'trialing', 'past_due')
      ORDER BY full_name`,
    [cohortId]
  );
  return rows;
}
