import { query, queryOne } from './db.js';
import { retryFailedEmails, sendOnce } from './email.js';
import {
  adminDigest,
  dashboardUrl,
  deliverableDueSoon,
  deliverablePublished,
  leaderboardUrl,
  weeklyDigest,
} from './emails/templates.js';
import {
  autoDecisionFor,
  decide,
  firstName,
  getActiveCohort,
  seatCounts,
  sendDecisionEmail,
} from './applications.js';
import {
  activeMembers,
  dueWithin,
  missingSubmissions,
  publishDue,
} from './deliverables.js';
import { recomputePoints, recomputeStreaks, snapshotLeaderboard } from './leaderboard.js';
import { pruneRateLimits } from './ratelimit.js';
import { REVIEW_SLA_DAYS, adminEmails, siteUrl } from './env.js';
import { formatDateTime, formatDay } from './format.js';

/**
 * Every job records a row in `job_runs` so an operator can answer "did the
 * Monday email actually go out?" without reading logs.
 */
export async function recordRun(job, fn) {
  const run = await queryOne(`INSERT INTO job_runs (job) VALUES ($1) RETURNING id`, [job]);
  try {
    const summary = await fn();
    await query(
      `UPDATE job_runs SET finished_at = now(), ok = true, summary = $2 WHERE id = $1`,
      [run.id, JSON.stringify(summary ?? {})]
    );
    return summary;
  } catch (err) {
    await query(
      `UPDATE job_runs SET finished_at = now(), ok = false, error = $2 WHERE id = $1`,
      [run.id, String(err.message).slice(0, 500)]
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Weekly: publish work, recompute the board, send the digest
// ---------------------------------------------------------------------------

export async function runWeekly() {
  const cohort = await getActiveCohort();
  if (!cohort) return { skipped: 'no active cohort' };

  const summary = { cohort: cohort.slug };

  // 1. Publish anything whose time has come, and announce it.
  const published = await publishDue(cohort.id);
  summary.published = published.map((d) => d.week_number);

  const members = await activeMembers(cohort.id);
  summary.members = members.length;

  let announcements = 0;
  for (const deliverable of published) {
    for (const member of members) {
      const tpl = deliverablePublished({
        name: firstName(member.full_name),
        weekNumber: deliverable.week_number,
        title: deliverable.title,
        description: deliverable.description,
        dueLabel: formatDateTime(deliverable.due_at),
        points: deliverable.points_value,
        dashboardUrl: dashboardUrl(),
      });
      const result = await sendOnce({
        to: member.email,
        template: 'deliverable_published',
        dedupeKey: `deliverable:${deliverable.id}:published:${member.id}`,
        ...tpl,
      });
      if (result.sent) announcements += 1;
    }
  }
  summary.announcements = announcements;

  // 2. Rebuild standings from the submissions ledger, then freeze them.
  await recomputePoints(cohort.id);
  await recomputeStreaks(cohort.id);
  const snapshot = await snapshotLeaderboard(cohort.id);
  summary.week = snapshot.week;
  summary.ranked = snapshot.entries.length;

  // 3. Digest. Every active member hears where they stand, every week.
  const leader = snapshot.entries[0];
  let digests = 0;
  for (const entry of snapshot.entries) {
    const member = members.find((m) => m.id === entry.id);
    if (!member) continue;
    const tpl = weeklyDigest({
      name: firstName(member.full_name),
      weekOfLabel: formatDay(snapshot.week),
      rank: entry.rank,
      totalMembers: snapshot.entries.length,
      points: entry.points,
      pointsDelta: entry.points_delta,
      streakWeeks: entry.streak_weeks,
      leaderName: leader ? leader.full_name : '—',
      leaderPoints: leader ? leader.points : 0,
      leaderboardUrl: leaderboardUrl(),
    });
    const result = await sendOnce({
      to: member.email,
      template: 'weekly_digest',
      dedupeKey: `digest:${cohort.id}:${snapshot.week}:${member.id}`,
      ...tpl,
    });
    if (result.sent) digests += 1;
  }
  summary.digests = digests;

  // 4. Operator digest.
  summary.adminDigests = await sendAdminDigest(cohort, snapshot.week);

  return summary;
}

async function sendAdminDigest(cohort, week) {
  const recipients = adminEmails();
  if (!recipients.length) return 0;

  const stats = await queryOne(
    `SELECT
       (SELECT count(*) FROM applications
         WHERE cohort_id = $1 AND status = 'under_review')::int AS pending,
       (SELECT count(*) FROM submissions s
          JOIN members m ON m.id = s.member_id
         WHERE m.cohort_id = $1 AND s.status <> 'graded')::int AS ungraded,
       (SELECT count(*) FROM (
          SELECT m.id
            FROM members m
            JOIN deliverables d ON d.cohort_id = m.cohort_id
                               AND d.published_at IS NOT NULL AND d.due_at < now()
            LEFT JOIN submissions s ON s.deliverable_id = d.id AND s.member_id = m.id
           WHERE m.cohort_id = $1
             AND m.sub_status IN ('active', 'trialing', 'past_due')
             AND s.id IS NULL
           GROUP BY m.id
          HAVING count(*) >= 2
       ) x)::int AS at_risk`,
    [cohort.id]
  );

  let sent = 0;
  for (const to of recipients) {
    const tpl = adminDigest({
      weekOfLabel: formatDay(week),
      pendingReviews: stats.pending,
      ungraded: stats.ungraded,
      atRisk: stats.at_risk,
      adminUrl: `${siteUrl()}/admin`,
    });
    const result = await sendOnce({
      to,
      template: 'admin_digest',
      dedupeKey: `admindigest:${cohort.id}:${week}:${to}`,
      ...tpl,
    });
    if (result.sent) sent += 1;
  }
  return sent;
}

// ---------------------------------------------------------------------------
// Daily: nudges, funnel hygiene, maintenance
// ---------------------------------------------------------------------------

export async function runDaily() {
  const cohort = await getActiveCohort();
  const summary = {};

  if (cohort) {
    summary.cohort = cohort.slug;
    summary.nudges = await sendDueSoonNudges(cohort.id);
    summary.expiredInvites = await expireStaleInvites(cohort.id);
    summary.swept = await sweepStaleApplications(cohort.id);
    summary.promoted = await promoteFromWaitlist(cohort.id);
  }

  summary.emailRetries = await retryFailedEmails();
  summary.pruned = await pruneExpired();

  return summary;
}

/**
 * Two nudges per deliverable, no more: one when it is a few days out and one on
 * the final day. The bucket is baked into the dedupe key, so running the cron
 * hourly would still produce exactly two emails.
 */
async function sendDueSoonNudges(cohortId) {
  const deliverables = await dueWithin(cohortId, 72);
  let sent = 0;

  for (const deliverable of deliverables) {
    const hoursLeft = (new Date(deliverable.due_at).getTime() - Date.now()) / 3_600_000;
    const bucket = hoursLeft > 24 ? 'early' : 'final';
    const pending = await missingSubmissions(deliverable.id);

    for (const member of pending) {
      const tpl = deliverableDueSoon({
        name: firstName(member.full_name),
        weekNumber: deliverable.week_number,
        title: deliverable.title,
        dueLabel: formatDateTime(deliverable.due_at),
        streakWeeks: member.streak_weeks,
        dashboardUrl: dashboardUrl(),
      });
      const result = await sendOnce({
        to: member.email,
        template: 'deliverable_due_soon',
        dedupeKey: `nudge:${deliverable.id}:${member.id}:${bucket}`,
        ...tpl,
      });
      if (result.sent) sent += 1;
    }
  }
  return sent;
}

/**
 * An accept invite that was never claimed has to stop occupying a seat, and the
 * applicant has to stop being 'accepted' so they can apply to a later cohort.
 */
async function expireStaleInvites(cohortId) {
  const { rowCount } = await query(
    `UPDATE applications
        SET status = 'withdrawn',
            status_reason = 'invite expired unclaimed',
            invite_token_hash = NULL,
            updated_at = now()
      WHERE cohort_id = $1
        AND status = 'accepted'
        AND invite_used_at IS NULL
        AND invite_expires_at < now()`,
    [cohortId]
  );
  return rowCount;
}

/** Applications a human never got to are decided by the rubric after the SLA. */
async function sweepStaleApplications(cohortId) {
  const { rows } = await query(
    `SELECT id, score FROM applications
      WHERE cohort_id = $1
        AND status = 'under_review'
        AND created_at < now() - ($2 || ' days')::interval
      ORDER BY score DESC, created_at ASC`,
    [cohortId, String(REVIEW_SLA_DAYS)]
  );

  const cohort = await queryOne(`SELECT * FROM cohorts WHERE id = $1`, [cohortId]);
  let decided = 0;

  for (const row of rows) {
    // Recomputed inside the loop: each acceptance consumes a seat, so a batch of
    // stale applications must not all be accepted against the same free seat.
    const { seatsLeft } = await seatCounts(cohortId);
    const target = autoDecisionFor(row.score, seatsLeft);
    const status = target === 'under_review' ? (seatsLeft > 0 ? 'accepted' : 'waitlisted') : target;

    const result = await decide({
      applicationId: row.id,
      status,
      decidedBy: 'auto',
      reason: `auto after ${REVIEW_SLA_DAYS}d review window (score ${row.score}/100)`,
    });
    if (!result.changed) continue;

    await sendDecisionEmail({
      application: result.application,
      inviteToken: result.inviteToken,
      cohort,
      seatsLeft,
    }).catch((err) => console.error('[jobs] sweep email failed:', err.message));
    decided += 1;
  }
  return decided;
}

/** Fill seats freed by cancellations or lapsed invites, in waitlist order. */
async function promoteFromWaitlist(cohortId) {
  const cohort = await queryOne(`SELECT * FROM cohorts WHERE id = $1`, [cohortId]);
  let promoted = 0;

  // Bounded loop: each promotion mints an invite that immediately holds a seat,
  // so this converges — the cap is belt-and-braces against a future change that
  // stops seat accounting from decrementing.
  for (let guard = 0; guard < 200; guard += 1) {
    const { seatsLeft } = await seatCounts(cohortId);
    if (seatsLeft <= 0) break;

    const next = await queryOne(
      `SELECT id FROM applications
        WHERE cohort_id = $1 AND status = 'waitlisted'
        ORDER BY waitlist_rank NULLS LAST, score DESC, created_at ASC
        LIMIT 1`,
      [cohortId]
    );
    if (!next) break;

    const result = await decide({
      applicationId: next.id,
      status: 'accepted',
      decidedBy: 'auto',
      reason: 'promoted from waitlist',
    });
    if (!result.changed) break;

    await sendDecisionEmail({
      application: result.application,
      inviteToken: result.inviteToken,
      cohort,
      seatsLeft,
    }).catch((err) => console.error('[jobs] promotion email failed:', err.message));
    promoted += 1;
  }
  return promoted;
}

async function pruneExpired() {
  const sessions = await query(`DELETE FROM sessions WHERE expires_at < now()`);
  const tokens = await query(
    `DELETE FROM login_tokens WHERE expires_at < now() - INTERVAL '7 days'`
  );
  const buckets = await pruneRateLimits();
  return { sessions: sessions.rowCount, loginTokens: tokens.rowCount, rateLimitWindows: buckets };
}
