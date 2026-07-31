import { query, queryOne, transaction } from './db.js';
import { newToken } from './auth.js';
import { sendOnce } from './email.js';
import {
  applicationAccepted,
  applicationReceived,
  applicationRejected,
  applicationWaitlisted,
} from './emails/templates.js';
import {
  AUTO_ACCEPT_SCORE,
  COHORT_PRICE_CENTS,
  MIN_VIABLE_SCORE,
  intEnv,
  siteUrl,
} from './env.js';
import { formatDate, formatMoney } from './format.js';

const INVITE_TTL_DAYS = intEnv('INVITE_TTL_DAYS', 7);

// ---------------------------------------------------------------------------
// Vetting score
// ---------------------------------------------------------------------------

/**
 * Deterministic 0-100 rubric. It deliberately weights *demonstrated thinking*
 * (the thesis answer) far above credentials — a sophomore who writes a real
 * variant perception should beat a senior who writes a company summary.
 *
 * Pure function of the submitted answers, so it is trivially testable and a
 * decision can always be explained back to an applicant.
 */
export function scoreApplication(app) {
  const breakdown = {};

  breakdown.thesis = scoreThesis(app.recent_thesis);
  breakdown.motivation = scoreProse(app.why_join, 15, 400);

  const hours = Number(app.hours_per_week) || 0;
  breakdown.commitment = hours >= 8 ? 15 : hours >= 5 ? 10 : hours >= 3 ? 5 : 0;

  breakdown.experience = { none: 4, beginner: 8, intermediate: 12, advanced: 15 }[app.experience_level] ?? 0;

  breakdown.brokerage = app.has_brokerage ? 5 : 0;

  const gpa = app.gpa == null ? null : Number(app.gpa);
  breakdown.gpa = gpa == null ? 4 : gpa >= 3.5 ? 10 : gpa >= 3.0 ? 7 : gpa >= 2.5 ? 4 : 1;

  breakdown.signals =
    (app.linkedin_url ? 3 : 0) + (app.target_role && app.target_role.trim().length > 2 ? 2 : 0);

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { score: Math.max(0, Math.min(100, Math.round(total))), breakdown };
}

/** Max 35. Rewards specificity: numbers, named risks, a stated variant view. */
function scoreThesis(text) {
  const value = String(text || '').trim();
  if (value.length < 80) return 0;

  let score = scoreProse(value, 18, 900);

  const lower = value.toLowerCase();
  const hasNumbers = /\d+(\.\d+)?\s*(%|x\b|bps|billion|million|bn|mm)/.test(lower);
  const namesRisk = /(risk|wrong|bear case|downside|disconfirm|fail)/.test(lower);
  const namesVariant = /(variant|consensus|market (is )?(mispric|miss)|underappreciat|overlook)/.test(lower);
  const namesCatalyst = /(catalyst|re-?rate|inflect|guidance|earnings)/.test(lower);
  const namesValuation = /(multiple|ev\/|p\/e|fcf|dcf|margin|roic|yield)/.test(lower);

  if (hasNumbers) score += 4;
  if (namesRisk) score += 4;
  if (namesVariant) score += 5;
  if (namesCatalyst) score += 2;
  if (namesValuation) score += 2;

  return Math.min(35, score);
}

/** Length-based prose credit that saturates — long is not the same as good. */
function scoreProse(text, max, saturationChars) {
  const len = String(text || '').trim().length;
  if (len < 40) return 0;
  return Math.round(max * Math.min(1, len / saturationChars));
}

// ---------------------------------------------------------------------------
// Seat accounting
// ---------------------------------------------------------------------------

export async function getActiveCohort(db) {
  return runOne(db, `SELECT * FROM cohorts WHERE is_active ORDER BY starts_on LIMIT 1`);
}

/**
 * Seats are consumed by paying members *and* by outstanding accept invites —
 * otherwise the auto-accepter would happily hand out 200 invites for 30 seats.
 */
export async function seatCounts(cohortId, db) {
  const row = await runOne(
    db,
    // Operator accounts are excluded: capacity is the number of *student*
    // seats, and an admin row would otherwise silently eat one — a 30-seat
    // cohort would advertise 29 open before anybody had applied.
    `SELECT c.capacity,
            (SELECT count(*) FROM members m
              WHERE m.cohort_id = c.id
                AND m.is_admin = false
                AND m.sub_status IN ('active', 'trialing', 'past_due'))::int AS filled,
            (SELECT count(*) FROM applications a
              WHERE a.cohort_id = c.id
                AND a.status = 'accepted'
                AND a.invite_used_at IS NULL
                AND a.invite_expires_at > now())::int AS held
       FROM cohorts c WHERE c.id = $1`,
    [cohortId]
  );
  if (!row) return { capacity: 0, filled: 0, held: 0, seatsLeft: 0 };
  const seatsLeft = Math.max(0, row.capacity - row.filled - row.held);
  return { ...row, seatsLeft };
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

/** What the auto-vetter would do with this score right now. */
export function autoDecisionFor(score, seatsLeft) {
  if (score < MIN_VIABLE_SCORE) return 'rejected';
  if (score >= AUTO_ACCEPT_SCORE) return seatsLeft > 0 ? 'accepted' : 'waitlisted';
  return 'under_review';
}

/**
 * Move an application to a terminal-ish state and mint an invite if accepted.
 *
 * Returns `{ application, inviteToken }` — the plaintext invite token exists
 * only in this return value; the database stores nothing but its SHA-256.
 * Deliberately does **no** email sending: callers send after the transaction
 * commits, so a slow mail provider can never hold a row lock.
 */
export async function decide({ applicationId, status, decidedBy, reason }) {
  return transaction(async (client) => {
    const app = await client
      .query(`SELECT * FROM applications WHERE id = $1 FOR UPDATE`, [applicationId])
      .then((r) => r.rows[0]);
    if (!app) throw new Error('Application not found');

    if (app.status === status) return { application: app, inviteToken: null, changed: false };
    if (['enrolled', 'withdrawn'].includes(app.status)) {
      throw new Error(`Cannot change a ${app.status} application`);
    }

    let inviteToken = null;
    let inviteHash = null;
    let waitlistRank = null;

    if (status === 'accepted') {
      const t = newToken();
      inviteToken = t.token;
      inviteHash = t.hash;
    } else if (status === 'waitlisted') {
      waitlistRank = app.waitlist_rank ?? (await nextWaitlistRank(client, app.cohort_id));
    }

    const updated = await client
      .query(
        // $2 is bound as text and cast where the enum is needed: using it both
        // ways uncast makes Postgres deduce inconsistent types for the
        // parameter and reject the statement outright (42P08).
        `UPDATE applications
            SET status = $2::application_status,
                status_reason = $3,
                decided_at = now(),
                decided_by = $4,
                updated_at = now(),
                waitlist_rank = COALESCE($5::int, waitlist_rank),
                invite_token_hash = CASE WHEN $2 = 'accepted' THEN $6 ELSE NULL END,
                invite_expires_at = CASE WHEN $2 = 'accepted'
                                         THEN now() + ($7 || ' days')::interval ELSE NULL END
          WHERE id = $1
          RETURNING *`,
        [
          applicationId,
          status,
          reason ?? null,
          decidedBy,
          waitlistRank,
          inviteHash,
          String(INVITE_TTL_DAYS),
        ]
      )
      .then((r) => r.rows[0]);

    return { application: updated, inviteToken, changed: true };
  });
}

async function nextWaitlistRank(client, cohortId) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX(waitlist_rank), 0) + 1 AS next
       FROM applications WHERE cohort_id = $1`,
    [cohortId]
  );
  return rows[0].next;
}

/**
 * Fire the status email for a decision. Idempotent per (application, status):
 * calling it twice — or a cron retry — sends one message.
 */
export async function sendDecisionEmail({ application, inviteToken, cohort, seatsLeft }) {
  const name = firstName(application.full_name);
  const cohortName = cohort?.name ?? 'the cohort';
  const base = { to: application.email, dedupeKey: `app:${application.id}:${application.status}` };

  if (application.status === 'accepted') {
    if (!inviteToken) {
      // No plaintext token available (e.g. a resend). Re-minting belongs to
      // decide(); silently doing it here would invalidate the live invite.
      console.warn(`[applications] accepted email skipped for ${application.id}: no invite token`);
      return { sent: false, reason: 'no-token' };
    }
    const tpl = applicationAccepted({
      name,
      cohortName,
      inviteUrl: `${siteUrl()}/join/${inviteToken}`,
      priceLabel: formatMoney(COHORT_PRICE_CENTS),
      seatsLeft: Math.max(1, seatsLeft ?? 1),
      expiresLabel: formatDate(application.invite_expires_at, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    });
    return sendOnce({ ...base, template: 'application_accepted', ...tpl });
  }

  if (application.status === 'waitlisted') {
    const tpl = applicationWaitlisted({ name, cohortName, rank: application.waitlist_rank ?? 1 });
    return sendOnce({ ...base, template: 'application_waitlisted', ...tpl });
  }

  if (application.status === 'rejected') {
    const tpl = applicationRejected({ name, cohortName });
    return sendOnce({ ...base, template: 'application_rejected', ...tpl });
  }

  const tpl = applicationReceived({ name, cohortName });
  return sendOnce({ ...base, template: 'application_received', ...tpl });
}

export function firstName(fullName) {
  return String(fullName || '').trim().split(/\s+/)[0] || 'there';
}

// ---------------------------------------------------------------------------

function runOne(db, text, params) {
  if (db) return db.query(text, params).then((r) => r.rows[0] ?? null);
  return queryOne(text, params);
}
