import { query, queryOne } from './db.js';
import { weekOf } from './format.js';
import { adminEmails } from './env.js';

/**
 * Points are stored denormalized on `members` so the leaderboard is a single
 * indexed read. This recomputes them from the submissions ledger, which is the
 * source of truth — cohorts are ~30 people, so a full recompute is cheap and
 * removes any chance of the cached total drifting.
 */
export async function recomputePoints(cohortId) {
  const { rowCount } = await query(
    `UPDATE members m
        SET points = COALESCE((
              SELECT SUM(s.points_awarded)::int
                FROM submissions s
               WHERE s.member_id = m.id
            ), 0)
      WHERE m.cohort_id = $1`,
    [cohortId]
  );
  return rowCount;
}

/**
 * A streak is the run of consecutive *closed* weeks (published and past due)
 * ending at the most recent one, in which the member submitted. Missing a week
 * resets it to zero — that is the entire behavioural point of the mechanic.
 */
export async function recomputeStreaks(cohortId) {
  const { rows } = await query(
    `SELECT m.id AS member_id, d.week_number, (s.id IS NOT NULL) AS submitted
       FROM members m
       CROSS JOIN deliverables d
       LEFT JOIN submissions s ON s.deliverable_id = d.id AND s.member_id = m.id
      WHERE m.cohort_id = $1
        AND d.cohort_id = $1
        AND d.published_at IS NOT NULL
        AND d.due_at <= now()
      ORDER BY m.id, d.week_number DESC`,
    [cohortId]
  );

  // Rows arrive grouped by member, weeks descending, so the streak is simply
  // the leading run of `submitted` before the first gap.
  const byMember = new Map();
  for (const row of rows) {
    if (!byMember.has(row.member_id)) byMember.set(row.member_id, []);
    byMember.get(row.member_id).push(row.submitted);
  }

  const ids = [];
  const values = [];
  for (const [memberId, flags] of byMember) {
    let streak = 0;
    for (const submitted of flags) {
      if (!submitted) break;
      streak += 1;
    }
    ids.push(memberId);
    values.push(streak);
  }

  if (!ids.length) return 0;

  await query(
    `UPDATE members m
        SET streak_weeks = v.streak
       FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::int[]) AS streak) v
      WHERE m.id = v.id`,
    [ids, values]
  );
  return ids.length;
}

/**
 * Operators are not competitors.
 *
 * An admin sitting at the bottom of a student ranking with zero points is noise
 * in every real cohort, so they are excluded from the board, from the snapshot,
 * and from the weekly "you're #N" digest. Admin status can come from either the
 * `is_admin` column or the ADMIN_EMAILS allowlist, so both are checked here —
 * filtering on the column alone would leave an env-configured operator ranked.
 */
const rankedMemberSql = (adminsParam) => `
        m.sub_status IN ('active', 'trialing', 'past_due')
    AND m.is_admin = false
    AND lower(m.email::text) <> ALL(${adminsParam}::text[])`;

export async function getLeaderboard(cohortId, { limit = 100 } = {}) {
  const { rows } = await query(
    `SELECT m.id, m.full_name, m.points, m.streak_weeks, m.joined_at,
            RANK() OVER (ORDER BY m.points DESC, m.streak_weeks DESC, m.joined_at ASC) AS rank,
            (SELECT count(*) FROM submissions s WHERE s.member_id = m.id)::int AS submissions,
            (SELECT ls.points_delta FROM leaderboard_snapshots ls
              WHERE ls.member_id = m.id ORDER BY ls.week_of DESC LIMIT 1) AS last_delta
       FROM members m
      WHERE m.cohort_id = $1
        AND ${rankedMemberSql('$3')}
      ORDER BY rank
      LIMIT $2`,
    [cohortId, limit, adminEmails()]
  );
  return rows.map((r) => ({ ...r, rank: Number(r.rank) }));
}

/**
 * A member's own standing. `ranked: false` means they are an operator rather
 * than a competitor — the dashboard shows that instead of a misleading dash.
 */
export async function getStanding(memberId, cohortId) {
  const row = await queryOne(
    `WITH ranked AS (
       SELECT m.id, m.points, m.streak_weeks,
              RANK() OVER (ORDER BY m.points DESC, m.streak_weeks DESC, m.joined_at ASC) AS rank,
              count(*) OVER () AS total
         FROM members m
        WHERE m.cohort_id = $2
          AND ${rankedMemberSql('$3')}
     )
     SELECT * FROM ranked WHERE id = $1`,
    [memberId, cohortId, adminEmails()]
  );

  if (!row) {
    // Not ranked: an operator, or a lapsed membership. Still report the cohort
    // size so the dashboard can say "of N" truthfully.
    const totals = await queryOne(
      `SELECT count(*)::int AS total,
              (SELECT points FROM members WHERE id = $1) AS points,
              (SELECT streak_weeks FROM members WHERE id = $1) AS streak_weeks
         FROM members m
        WHERE m.cohort_id = $2
          AND ${rankedMemberSql('$3')}`,
      [memberId, cohortId, adminEmails()]
    );
    return {
      rank: null,
      ranked: false,
      total: totals?.total ?? 0,
      points: totals?.points ?? 0,
      streak_weeks: totals?.streak_weeks ?? 0,
    };
  }

  return {
    rank: Number(row.rank),
    ranked: true,
    total: Number(row.total),
    points: row.points,
    streak_weeks: row.streak_weeks,
  };
}

/**
 * Freeze this week's standings. The delta against the previous snapshot is what
 * the weekly digest email reports, so it has to be written even when nothing
 * moved.
 */
export async function snapshotLeaderboard(cohortId, when = new Date()) {
  const week = weekOf(when);
  const board = await getLeaderboard(cohortId, { limit: 1000 });

  const previous = await query(
    `SELECT member_id, points
       FROM leaderboard_snapshots
      WHERE cohort_id = $1
        AND week_of = (SELECT MAX(week_of) FROM leaderboard_snapshots
                        WHERE cohort_id = $1 AND week_of < $2)`,
    [cohortId, week]
  );
  const priorPoints = new Map(previous.rows.map((r) => [r.member_id, r.points]));

  const written = [];
  for (const entry of board) {
    const delta = entry.points - (priorPoints.get(entry.id) ?? 0);
    await query(
      `INSERT INTO leaderboard_snapshots (cohort_id, member_id, week_of, rank, points, points_delta)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (cohort_id, member_id, week_of)
       DO UPDATE SET rank = EXCLUDED.rank,
                     points = EXCLUDED.points,
                     points_delta = EXCLUDED.points_delta`,
      [cohortId, entry.id, week, entry.rank, entry.points, delta]
    );
    written.push({ ...entry, points_delta: delta });
  }

  return { week, entries: written };
}
