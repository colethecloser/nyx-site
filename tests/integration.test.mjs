/**
 * End-to-end tests against a real Postgres.
 *
 * Run with DATABASE_URL pointing at a throwaway database — every test truncates
 * it. Stripe and Resend are stubbed in-process (see helpers.mjs); no network
 * call is made, and an unexpected one throws.
 *
 *   DATABASE_URL=postgres://... node --test tests/
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  makeSubscription,
  readSql,
  resetDb,
  sentEmails,
  stubResend,
  stubStripe,
  validApplication,
} from './helpers.mjs';

// Must be set before any lib module opens a pool or reads config.
process.env.RESEND_API_KEY ||= 're_test_key';
process.env.EMAIL_FROM ||= 'Cohort <cohort@test.dev>';
process.env.NEXT_PUBLIC_SITE_URL ||= 'https://cohort.test';
process.env.CRON_SECRET ||= 'test-cron-secret';
process.env.ADMIN_EMAILS ||= 'admin@fgcu.edu';
process.env.STRIPE_SECRET_KEY ||= 'sk_test_stub';

const restoreFetch = stubResend();

const { query, queryOne, getPool } = await import('../lib/db.js');
const {
  decide,
  scoreApplication,
  seatCounts,
  sendDecisionEmail,
  autoDecisionFor,
} = await import('../lib/applications.js');
const { handleStripeEvent, claimEvent } = await import('../lib/billing.js');
const { recordRun, runDaily, runWeekly } = await import('../lib/jobs.js');
const { getLeaderboard, getStanding, recomputePoints, recomputeStreaks, snapshotLeaderboard } =
  await import('../lib/leaderboard.js');
const { hashToken, createLoginToken, consumeLoginToken, createSession, getMemberBySessionToken, isAuthorizedCron } =
  await import('../lib/auth.js');
const { rateLimit } = await import('../lib/ratelimit.js');
const { provisionalPoints } = await import('../lib/deliverables.js');
const { SubmissionError, saveSubmission } = await import('../lib/submissions.js');

before(async () => {
  await query(readSql('schema.sql'));
});

after(async () => {
  restoreFetch();
  await getPool().end();
});

beforeEach(async () => {
  await resetDb(query);
  stubStripe();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A cohort whose weeks 1-2 are already closed and week 3 is open. */
async function seedCohort({ capacity = 30 } = {}) {
  const cohort = await queryOne(
    `INSERT INTO cohorts (slug, name, starts_on, ends_on, capacity)
     VALUES ('test', 'Test Cohort', now()::date - 21, now()::date + 35, $1)
     RETURNING *`,
    [capacity]
  );

  const weeks = [
    { n: 1, publish: '-21 days', due: '-14 days', points: 100 },
    { n: 2, publish: '-14 days', due: '-7 days', points: 100 },
    { n: 3, publish: '-2 days', due: '+2 days', points: 100 },
    { n: 4, publish: '+5 days', due: '+12 days', points: 120 },
  ];
  for (const w of weeks) {
    await query(
      `INSERT INTO deliverables (cohort_id, week_number, title, description, points_value,
                                 publish_at, due_at, published_at)
       VALUES ($1, $2, $3, 'Do the work.', $4,
               now() + $5::interval, now() + $6::interval,
               CASE WHEN $5::interval < INTERVAL '0' THEN now() + $5::interval ELSE NULL END)`,
      [cohort.id, w.n, `Week ${w.n}`, w.points, w.publish, w.due]
    );
  }
  return cohort;
}

async function insertApplication(cohort, overrides = {}) {
  const input = { ...validApplication(), ...overrides };
  const { score, breakdown } = scoreApplication(input);
  return queryOne(
    `INSERT INTO applications (
       cohort_id, email, full_name, grad_year, major, gpa, experience_level,
       hours_per_week, has_brokerage, why_join, recent_thesis, score, score_breakdown)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      cohort.id, input.email, input.full_name, input.grad_year, input.major, input.gpa,
      input.experience_level, input.hours_per_week, input.has_brokerage, input.why_join,
      input.recent_thesis, score, JSON.stringify(breakdown),
    ]
  );
}

function checkoutEvent(application, { subscriptionId = 'sub_test_1', eventId = 'evt_1' } = {}) {
  return {
    id: eventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        mode: 'subscription',
        payment_status: 'paid',
        subscription: subscriptionId,
        customer: 'cus_test_1',
        customer_details: { email: application.email },
        client_reference_id: application.id,
        metadata: { application_id: application.id, cohort_id: application.cohort_id },
      },
    },
  };
}

const emailsTo = (address) => sentEmails.filter((e) => e.to.includes(address));
const emailsMatching = (fragment) =>
  sentEmails.filter((e) => e.subject.toLowerCase().includes(fragment.toLowerCase()));

// ---------------------------------------------------------------------------
// The funnel
// ---------------------------------------------------------------------------

test('funnel: accept → invite → paid → member, with the invite burned exactly once', async () => {
  const cohort = await seedCohort();
  const application = await insertApplication(cohort);

  const { application: accepted, inviteToken } = await decide({
    applicationId: application.id,
    status: 'accepted',
    decidedBy: 'auto',
  });

  assert.equal(accepted.status, 'accepted');
  assert.ok(inviteToken, 'an invite token is minted on acceptance');
  assert.equal(accepted.invite_token_hash, hashToken(inviteToken), 'only the hash is stored');
  assert.notEqual(accepted.invite_token_hash, inviteToken);

  await sendDecisionEmail({ application: accepted, inviteToken, cohort, seatsLeft: 4 });
  const acceptMail = emailsTo(application.email)[0];
  assert.ok(acceptMail, 'the applicant is emailed');
  assert.ok(acceptMail.html.includes(`/join/${inviteToken}`), 'the email carries the claim link');

  // A seat is now held even though nobody has paid.
  assert.equal((await seatCounts(cohort.id)).held, 1);

  const subscriptions = new Map([['sub_test_1', makeSubscription()]]);
  stubStripe({ subscriptions });

  const result = await handleStripeEvent(checkoutEvent(accepted));
  assert.equal(result.handled, true);
  assert.equal(result.created, true);

  const member = await queryOne(`SELECT * FROM members WHERE email = $1`, [application.email]);
  assert.ok(member);
  assert.equal(member.sub_status, 'active');
  assert.equal(member.stripe_subscription_id, 'sub_test_1');
  assert.equal(member.stripe_customer_id, 'cus_test_1');
  assert.equal(member.application_id, application.id);

  const after = await queryOne(`SELECT * FROM applications WHERE id = $1`, [application.id]);
  assert.equal(after.status, 'enrolled');
  assert.ok(after.invite_used_at, 'the invite is marked used');
  assert.equal(after.invite_token_hash, null, 'the invite hash is cleared, so the link is dead');

  assert.equal(emailsMatching('Welcome').length, 1, 'exactly one welcome email');

  // Seat accounting flips from "held" to "filled".
  const seats = await seatCounts(cohort.id);
  assert.equal(seats.held, 0);
  assert.equal(seats.filled, 1);
});

test('funnel: a used invite cannot be replayed to open a second checkout', async () => {
  const cohort = await seedCohort();
  const application = await insertApplication(cohort);
  const { application: accepted, inviteToken } = await decide({
    applicationId: application.id,
    status: 'accepted',
    decidedBy: 'auto',
  });

  stubStripe({ subscriptions: new Map([['sub_test_1', makeSubscription()]]) });
  await handleStripeEvent(checkoutEvent(accepted));

  // This is the exact lookup app/api/checkout performs.
  const stillValid = await queryOne(
    `SELECT id FROM applications
      WHERE invite_token_hash = $1 AND status = 'accepted'
        AND invite_used_at IS NULL AND invite_expires_at > now()`,
    [hashToken(inviteToken)]
  );
  assert.equal(stillValid, null, 'the burned invite no longer authorizes payment');
});

test('funnel: capacity is respected — a strong applicant with no seat is waitlisted', async () => {
  const cohort = await seedCohort({ capacity: 1 });
  const first = await insertApplication(cohort, { email: 'a@eagle.fgcu.edu' });
  await decide({ applicationId: first.id, status: 'accepted', decidedBy: 'auto' });

  const seats = await seatCounts(cohort.id);
  assert.equal(seats.seatsLeft, 0, 'the single seat is held by the outstanding invite');

  const second = await insertApplication(cohort, { email: 'b@eagle.fgcu.edu' });
  assert.ok(second.score >= 70, 'this applicant would otherwise be auto-accepted');
  assert.equal(autoDecisionFor(second.score, seats.seatsLeft), 'waitlisted');
});

test('funnel: decisions are terminal for enrolled applicants', async () => {
  const cohort = await seedCohort();
  const application = await insertApplication(cohort);
  await query(`UPDATE applications SET status = 'enrolled' WHERE id = $1`, [application.id]);

  await assert.rejects(
    () => decide({ applicationId: application.id, status: 'rejected', decidedBy: 'admin@fgcu.edu' }),
    /Cannot change a enrolled application/
  );
});

// ---------------------------------------------------------------------------
// Stripe webhooks
// ---------------------------------------------------------------------------

test('webhook: the same event id is processed exactly once', async () => {
  const cohort = await seedCohort();
  const application = await insertApplication(cohort);
  const { application: accepted } = await decide({
    applicationId: application.id, status: 'accepted', decidedBy: 'auto',
  });
  stubStripe({ subscriptions: new Map([['sub_test_1', makeSubscription()]]) });

  const event = checkoutEvent(accepted);
  assert.equal(await claimEvent(event), true, 'first delivery claims the event');
  await handleStripeEvent(event);
  assert.equal(await claimEvent(event), false, 'a retry of the same id is rejected');

  const { rows } = await query(`SELECT id FROM members`);
  assert.equal(rows.length, 1);
});

test('webhook: replaying the handler does not create a second member or a second welcome', async () => {
  const cohort = await seedCohort();
  const application = await insertApplication(cohort);
  const { application: accepted } = await decide({
    applicationId: application.id, status: 'accepted', decidedBy: 'auto',
  });
  stubStripe({ subscriptions: new Map([['sub_test_1', makeSubscription()]]) });

  await handleStripeEvent(checkoutEvent(accepted));
  await handleStripeEvent(checkoutEvent(accepted, { eventId: 'evt_2' }));

  const members = await query(`SELECT id FROM members`);
  assert.equal(members.rows.length, 1, 'the members upsert keys on email');
  assert.equal(emailsMatching('Welcome').length, 1, 'the email log dedupes the welcome');
});

test('webhook: payment failure moves the member to past_due and mails once per attempt', async () => {
  const cohort = await seedCohort();
  const application = await insertApplication(cohort);
  const { application: accepted } = await decide({
    applicationId: application.id, status: 'accepted', decidedBy: 'auto',
  });
  stubStripe({ subscriptions: new Map([['sub_test_1', makeSubscription()]]) });
  await handleStripeEvent(checkoutEvent(accepted));
  sentEmails.length = 0;

  const invoice = {
    id: 'in_1',
    subscription: 'sub_test_1',
    customer: 'cus_test_1',
    attempt_count: 1,
    next_payment_attempt: Math.floor(Date.now() / 1000) + 3 * 86_400,
  };

  await handleStripeEvent({ id: 'evt_f1', type: 'invoice.payment_failed', data: { object: invoice } });
  await handleStripeEvent({ id: 'evt_f1b', type: 'invoice.payment_failed', data: { object: invoice } });

  const member = await queryOne(`SELECT * FROM members WHERE email = $1`, [application.email]);
  assert.equal(member.sub_status, 'past_due');
  assert.equal(sentEmails.length, 1, 'the same dunning attempt mails once');

  // A later retry is a new attempt, so it earns a new email.
  await handleStripeEvent({
    id: 'evt_f2',
    type: 'invoice.payment_failed',
    data: { object: { ...invoice, attempt_count: 2 } },
  });
  assert.equal(sentEmails.length, 2);
});

test('webhook: past_due keeps access; cancellation revokes it and mails the member', async () => {
  const { hasAccess } = await import('../lib/auth.js');
  const cohort = await seedCohort();
  const application = await insertApplication(cohort);
  const { application: accepted } = await decide({
    applicationId: application.id, status: 'accepted', decidedBy: 'auto',
  });
  stubStripe({ subscriptions: new Map([['sub_test_1', makeSubscription()]]) });
  await handleStripeEvent(checkoutEvent(accepted));

  await query(`UPDATE members SET sub_status = 'past_due' WHERE email = $1`, [application.email]);
  let member = await queryOne(`SELECT * FROM members WHERE email = $1`, [application.email]);
  assert.equal(hasAccess(member), true, 'dunning must not lock the member out');

  sentEmails.length = 0;
  await handleStripeEvent({
    id: 'evt_del',
    type: 'customer.subscription.deleted',
    data: { object: makeSubscription({ status: 'canceled' }) },
  });

  member = await queryOne(`SELECT * FROM members WHERE email = $1`, [application.email]);
  assert.equal(member.sub_status, 'canceled');
  assert.equal(hasAccess(member), false);
  assert.equal(emailsMatching('membership has ended').length, 1);
});

test('webhook: an invoice that arrives before the member exists is dropped, not fatal', async () => {
  await seedCohort();
  const result = await handleStripeEvent({
    id: 'evt_early',
    type: 'invoice.paid',
    data: { object: { id: 'in_early', subscription: 'sub_unknown', customer: 'cus_unknown' } },
  });
  assert.equal(result.handled, false);
  assert.equal(result.reason, 'no member yet');
});

test('webhook: cancel_at_period_end round-trips from a subscription update', async () => {
  const cohort = await seedCohort();
  const application = await insertApplication(cohort);
  const { application: accepted } = await decide({
    applicationId: application.id, status: 'accepted', decidedBy: 'auto',
  });
  stubStripe({ subscriptions: new Map([['sub_test_1', makeSubscription()]]) });
  await handleStripeEvent(checkoutEvent(accepted));

  await handleStripeEvent({
    id: 'evt_upd',
    type: 'customer.subscription.updated',
    data: { object: makeSubscription({ cancel_at_period_end: true }) },
  });

  const member = await queryOne(`SELECT * FROM members WHERE email = $1`, [application.email]);
  assert.equal(member.cancel_at_period_end, true);
  assert.ok(member.current_period_end instanceof Date);
});

// ---------------------------------------------------------------------------
// Deliverables, points, leaderboard
// ---------------------------------------------------------------------------

/** Enrol `n` members directly, bypassing the payment funnel. */
async function enrolMembers(cohort, n) {
  const members = [];
  for (let i = 0; i < n; i += 1) {
    members.push(
      await queryOne(
        `INSERT INTO members (cohort_id, email, full_name, sub_status, stripe_customer_id, stripe_subscription_id)
         VALUES ($1, $2, $3, 'active', $4, $5) RETURNING *`,
        [cohort.id, `m${i}@eagle.fgcu.edu`, `Member ${i}`, `cus_${i}`, `sub_${i}`]
      )
    );
  }
  return members;
}

async function submit(member, weekNumber, { late = false } = {}) {
  const deliverable = await queryOne(
    `SELECT * FROM deliverables WHERE cohort_id = $1 AND week_number = $2`,
    [member.cohort_id, weekNumber]
  );
  const { points, status } = provisionalPoints(deliverable, late ? new Date(Date.now() + 1e10) : new Date());
  return queryOne(
    `INSERT INTO submissions (deliverable_id, member_id, notes, status, points_awarded)
     VALUES ($1, $2, 'work', $3::submission_status, $4) RETURNING *`,
    [deliverable.id, member.id, status, points]
  );
}

test('leaderboard: ranks on points, breaks ties on streak, and marks the delta', async () => {
  const cohort = await seedCohort();
  const [a, b, c] = await enrolMembers(cohort, 3);

  // Weeks 1 and 2 are already past due, so those submissions earn half credit
  // (50); week 3 is still open and earns the full 100.
  await submit(a, 1);
  await submit(a, 2);
  await submit(a, 3);
  await submit(b, 1);
  await submit(b, 2);
  await submit(c, 1);

  await recomputePoints(cohort.id);
  await recomputeStreaks(cohort.id);

  const board = await getLeaderboard(cohort.id);
  assert.deepEqual(
    board.map((r) => [r.full_name, r.points]),
    [['Member 0', 200], ['Member 1', 100], ['Member 2', 50]]
  );

  const standing = await getStanding(a.id, cohort.id);
  assert.equal(standing.rank, 1);
  assert.equal(standing.total, 3);
  assert.equal(standing.points, 200);
});

test('leaderboard: equal points are broken by the longer streak', async () => {
  const cohort = await seedCohort();
  const [a, b] = await enrolMembers(cohort, 2);

  // Both end on 100 points, but only `a` has an unbroken run of closed weeks:
  // `a` submitted weeks 1 and 2 at 50 each, `b` scored 100 on week 2 alone.
  await submit(a, 1);
  await submit(a, 2);
  const bWeek2 = await submit(b, 2);
  await query(`UPDATE submissions SET points_awarded = 100 WHERE id = $1`, [bWeek2.id]);

  await recomputePoints(cohort.id);
  await recomputeStreaks(cohort.id);

  const board = await getLeaderboard(cohort.id);
  assert.equal(board[0].points, board[1].points, 'the points really are tied');
  assert.equal(board[0].id, a.id, 'the longer streak ranks first');
  assert.equal(board[0].streak_weeks, 2);
  assert.equal(board[1].streak_weeks, 1);
});

test('leaderboard: a missed week resets the streak to zero', async () => {
  const cohort = await seedCohort();
  const [a, b] = await enrolMembers(cohort, 2);

  // Weeks 1 and 2 are closed. `a` did both; `b` skipped week 2.
  await submit(a, 1);
  await submit(a, 2);
  await submit(b, 1);

  await recomputeStreaks(cohort.id);

  const rows = await query(`SELECT full_name, streak_weeks FROM members ORDER BY full_name`);
  assert.deepEqual(
    rows.rows.map((r) => [r.full_name, r.streak_weeks]),
    [['Member 0', 2], ['Member 1', 0]],
    'the streak counts back from the most recent closed week and stops at the gap'
  );
});

test('leaderboard: snapshots record the week-over-week delta', async () => {
  const cohort = await seedCohort();
  const [a] = await enrolMembers(cohort, 1);

  // Weeks 1 and 2 are closed, so each submission is late and worth 50.
  await submit(a, 1);
  await recomputePoints(cohort.id);
  const first = await snapshotLeaderboard(cohort.id, new Date('2026-01-05T12:00:00Z'));
  assert.equal(first.entries[0].points, 50);
  assert.equal(first.entries[0].points_delta, 50);

  await submit(a, 2);
  await recomputePoints(cohort.id);
  const second = await snapshotLeaderboard(cohort.id, new Date('2026-01-12T12:00:00Z'));
  assert.equal(second.entries[0].points, 100);
  assert.equal(second.entries[0].points_delta, 50, 'delta is against the prior snapshot, not zero');
});

test('leaderboard: only members with live subscriptions appear', async () => {
  const cohort = await seedCohort();
  const [a, b] = await enrolMembers(cohort, 2);
  await query(`UPDATE members SET sub_status = 'canceled' WHERE id = $1`, [b.id]);

  const board = await getLeaderboard(cohort.id);
  assert.equal(board.length, 1);
  assert.equal(board[0].id, a.id);
});

test('submissions: on-time credit survives an edit made after the deadline', async () => {
  const cohort = await seedCohort();
  const [member] = await enrolMembers(cohort, 1);
  const week3 = await queryOne(
    `SELECT * FROM deliverables WHERE cohort_id = $1 AND week_number = 3`, [cohort.id]
  );

  // Week 3 is still open, so this earns full credit.
  const first = await saveSubmission({ member, deliverable: week3, url: null, notes: 'first pass' });
  assert.equal(first.created, true);
  assert.equal(first.submission.points_awarded, 100);
  assert.equal(first.submission.status, 'submitted');

  // The deadline passes, then the member fixes a typo.
  await query(`UPDATE deliverables SET due_at = now() - INTERVAL '1 hour' WHERE id = $1`, [week3.id]);
  const reloaded = await queryOne(`SELECT * FROM deliverables WHERE id = $1`, [week3.id]);
  const edit = await saveSubmission({ member, deliverable: reloaded, url: 'https://x.test/v2', notes: 'typo fixed' });

  assert.equal(edit.created, false);
  assert.equal(edit.submission.points_awarded, 100, 'editing must not downgrade to late credit');
  assert.equal(edit.submission.status, 'submitted');
  assert.equal(edit.submission.url, 'https://x.test/v2', 'but the content is updated');
  assert.equal(edit.submission.notes, 'typo fixed');
});

test('submissions: a first submission made after the deadline gets half credit', async () => {
  const cohort = await seedCohort();
  const [member] = await enrolMembers(cohort, 1);
  const week1 = await queryOne(
    `SELECT * FROM deliverables WHERE cohort_id = $1 AND week_number = 1`, [cohort.id]
  );

  const { submission } = await saveSubmission({ member, deliverable: week1, url: null, notes: 'late but done' });
  assert.equal(submission.points_awarded, 50);
  assert.equal(submission.status, 'late');
});

test('submissions: a graded submission is frozen', async () => {
  const cohort = await seedCohort();
  const [member] = await enrolMembers(cohort, 1);
  const week3 = await queryOne(
    `SELECT * FROM deliverables WHERE cohort_id = $1 AND week_number = 3`, [cohort.id]
  );

  await saveSubmission({ member, deliverable: week3, url: null, notes: 'original' });
  await query(`UPDATE submissions SET status = 'graded', points_awarded = 80, graded_at = now()`);

  await assert.rejects(
    () => saveSubmission({ member, deliverable: week3, url: null, notes: 'sneaky rewrite' }),
    (err) => err instanceof SubmissionError && err.status === 409
  );

  const row = await queryOne(`SELECT notes, points_awarded FROM submissions`);
  assert.equal(row.notes, 'original');
  assert.equal(row.points_awarded, 80);
});

// ---------------------------------------------------------------------------
// Cron
// ---------------------------------------------------------------------------

test('cron/weekly: publishes due work, mails it, snapshots the board — and reruns cleanly', async () => {
  const cohort = await seedCohort();
  const members = await enrolMembers(cohort, 3);
  await submit(members[0], 1);
  await recomputePoints(cohort.id);

  // Bring week 4 forward so this run has something new to publish.
  await query(
    `UPDATE deliverables SET publish_at = now() - INTERVAL '1 hour', published_at = NULL
      WHERE cohort_id = $1 AND week_number = 4`,
    [cohort.id]
  );

  // Wrapped exactly as the route does, so the job_runs audit trail is covered too.
  const first = await recordRun('weekly', runWeekly);
  assert.deepEqual(first.published, [4], 'week 4 goes live');
  assert.equal(first.announcements, 3, 'every active member is told');
  assert.equal(first.digests, 3, 'every active member gets a standing');
  assert.equal(first.ranked, 3);

  const mailCountAfterFirst = sentEmails.length;

  const second = await recordRun('weekly', runWeekly);
  assert.deepEqual(second.published, [], 'nothing is published twice');
  assert.equal(second.announcements, 0);
  assert.equal(second.digests, 0, 'the weekly digest is deduped for the same week');
  assert.equal(sentEmails.length, mailCountAfterFirst, 'a rerun sends no email at all');

  const runs = await query(`SELECT job, ok FROM job_runs WHERE job = 'weekly'`);
  assert.equal(runs.rows.length, 2);
  assert.ok(runs.rows.every((r) => r.ok === true));
});

test('cron/daily: nudges only members who have not submitted, once per bucket', async () => {
  const cohort = await seedCohort();
  const members = await enrolMembers(cohort, 3);
  await submit(members[0], 3); // week 3 is open and due in 2 days

  const first = await runDaily();
  assert.equal(first.nudges, 2, 'the member who submitted is left alone');

  const second = await runDaily();
  assert.equal(second.nudges, 0, 'the same bucket does not nudge twice');

  const recipients = sentEmails.filter((e) => e.subject.startsWith('Due ')).map((e) => e.to[0]).sort();
  assert.deepEqual(recipients, ['m1@eagle.fgcu.edu', 'm2@eagle.fgcu.edu']);
});

test('cron/daily: an unclaimed invite expires, frees its seat, and promotes the waitlist', async () => {
  const cohort = await seedCohort({ capacity: 1 });

  const lapsed = await insertApplication(cohort, { email: 'lapsed@eagle.fgcu.edu' });
  await decide({ applicationId: lapsed.id, status: 'accepted', decidedBy: 'auto' });
  await query(
    `UPDATE applications SET invite_expires_at = now() - INTERVAL '1 day' WHERE id = $1`,
    [lapsed.id]
  );

  const waiting = await insertApplication(cohort, { email: 'waiting@eagle.fgcu.edu' });
  await decide({ applicationId: waiting.id, status: 'waitlisted', decidedBy: 'auto' });
  sentEmails.length = 0;

  const summary = await runDaily();
  assert.equal(summary.expiredInvites, 1);
  assert.equal(summary.promoted, 1);

  const lapsedAfter = await queryOne(`SELECT status FROM applications WHERE id = $1`, [lapsed.id]);
  assert.equal(lapsedAfter.status, 'withdrawn');

  const promotedAfter = await queryOne(
    `SELECT status, invite_token_hash FROM applications WHERE id = $1`,
    [waiting.id]
  );
  assert.equal(promotedAfter.status, 'accepted');
  assert.ok(promotedAfter.invite_token_hash, 'the promoted applicant gets a fresh invite');
  assert.equal(emailsTo('waiting@eagle.fgcu.edu').length, 1, 'and is told about it');
});

test('cron/daily: stale reviews are decided automatically after the SLA', async () => {
  const cohort = await seedCohort();
  const stale = await insertApplication(cohort, { email: 'stale@eagle.fgcu.edu' });
  await query(
    `UPDATE applications SET created_at = now() - INTERVAL '10 days' WHERE id = $1`,
    [stale.id]
  );
  const fresh = await insertApplication(cohort, { email: 'fresh@eagle.fgcu.edu' });

  const summary = await runDaily();
  assert.equal(summary.swept, 1, 'only the application past the SLA is swept');

  const staleAfter = await queryOne(`SELECT status, decided_by FROM applications WHERE id = $1`, [stale.id]);
  assert.equal(staleAfter.status, 'accepted');
  assert.equal(staleAfter.decided_by, 'auto');

  const freshAfter = await queryOne(`SELECT status FROM applications WHERE id = $1`, [fresh.id]);
  assert.equal(freshAfter.status, 'under_review', 'a recent application still waits for a human');
});

test('cron/daily: the sweep cannot over-accept against a single free seat', async () => {
  const cohort = await seedCohort({ capacity: 1 });
  for (const email of ['s1@eagle.fgcu.edu', 's2@eagle.fgcu.edu', 's3@eagle.fgcu.edu']) {
    const app = await insertApplication(cohort, { email });
    await query(`UPDATE applications SET created_at = now() - INTERVAL '10 days' WHERE id = $1`, [app.id]);
  }

  await runDaily();

  const counts = await queryOne(
    `SELECT count(*) FILTER (WHERE status = 'accepted')::int AS accepted,
            count(*) FILTER (WHERE status = 'waitlisted')::int AS waitlisted
       FROM applications WHERE cohort_id = $1`,
    [cohort.id]
  );
  assert.equal(counts.accepted, 1, 'exactly one seat was handed out');
  assert.equal(counts.waitlisted, 2, 'the rest are queued');
});

test('cron: the endpoint guard rejects anything but the configured secret', () => {
  const withHeader = (value) => ({ headers: { get: (k) => (k === 'authorization' ? value : null) } });
  assert.equal(isAuthorizedCron(withHeader('Bearer test-cron-secret')), true);
  assert.equal(isAuthorizedCron(withHeader('Bearer wrong')), false);
  assert.equal(isAuthorizedCron(withHeader('test-cron-secret')), false, 'the Bearer prefix is required');
  assert.equal(isAuthorizedCron(withHeader(null)), false);
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

test('auth: a login token works once and then never again', async () => {
  const cohort = await seedCohort();
  const [member] = await enrolMembers(cohort, 1);

  const token = await createLoginToken(member.email);
  assert.equal(await consumeLoginToken(token), member.email);
  assert.equal(await consumeLoginToken(token), null, 'a replayed link is refused');
  assert.equal(await consumeLoginToken('not-a-token'), null);
});

test('auth: an expired login token is refused', async () => {
  const cohort = await seedCohort();
  const [member] = await enrolMembers(cohort, 1);
  const token = await createLoginToken(member.email);
  await query(`UPDATE login_tokens SET expires_at = now() - INTERVAL '1 minute'`);
  assert.equal(await consumeLoginToken(token), null);
});

test('auth: sessions resolve to a member, and admin comes from the allowlist', async () => {
  const cohort = await seedCohort();
  const [member] = await enrolMembers(cohort, 1);

  const token = await createSession(member.id, 'node-test');
  const resolved = await getMemberBySessionToken(token);
  assert.equal(resolved.id, member.id);
  assert.equal(resolved.cohort_name, 'Test Cohort');
  assert.equal(resolved.isAdmin, false);

  await query(`UPDATE members SET email = 'admin@fgcu.edu' WHERE id = $1`, [member.id]);
  const asAdmin = await getMemberBySessionToken(token);
  assert.equal(asAdmin.isAdmin, true, 'ADMIN_EMAILS grants admin');

  assert.equal(await getMemberBySessionToken('garbage'), null);
  assert.equal(await getMemberBySessionToken(undefined), null);
});

test('auth: an expired session no longer resolves', async () => {
  const cohort = await seedCohort();
  const [member] = await enrolMembers(cohort, 1);
  const token = await createSession(member.id, 'node-test');
  await query(`UPDATE sessions SET expires_at = now() - INTERVAL '1 second'`);
  assert.equal(await getMemberBySessionToken(token), null);
});

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

test('rate limit: allows up to the limit, then refuses inside the window', async () => {
  const key = `test:${Math.random()}`;
  const results = [];
  for (let i = 0; i < 5; i += 1) {
    results.push((await rateLimit({ key, limit: 3, windowSeconds: 60 })).ok);
  }
  assert.deepEqual(results, [true, true, true, false, false]);
});

test('applications: the partial unique index blocks a duplicate live application', async () => {
  const cohort = await seedCohort();
  await insertApplication(cohort, { email: 'dupe@eagle.fgcu.edu' });

  await assert.rejects(
    () => insertApplication(cohort, { email: 'dupe@eagle.fgcu.edu' }),
    (err) => err.code === '23505'
  );

  // Once the first is closed out, the applicant may try again.
  await query(`UPDATE applications SET status = 'rejected' WHERE email = 'dupe@eagle.fgcu.edu'`);
  const retry = await insertApplication(cohort, { email: 'dupe@eagle.fgcu.edu' });
  assert.ok(retry.id);
});

test('applications: email matching is case-insensitive', async () => {
  const cohort = await seedCohort();
  await insertApplication(cohort, { email: 'Case@eagle.fgcu.edu' });
  await assert.rejects(
    () => insertApplication(cohort, { email: 'case@EAGLE.fgcu.edu' }),
    (err) => err.code === '23505'
  );
});

test('email: the dedupe key makes a duplicate send a no-op', async () => {
  const { sendOnce } = await import('../lib/email.js');
  const payload = {
    to: 'x@eagle.fgcu.edu',
    template: 'test',
    dedupeKey: 'fixed-key',
    subject: 'Only once',
    html: '<p>hi</p>',
    text: 'hi',
  };

  const first = await sendOnce(payload);
  const second = await sendOnce(payload);

  assert.equal(first.sent, true);
  assert.equal(second.sent, false);
  assert.equal(second.reason, 'duplicate');
  assert.equal(emailsMatching('Only once').length, 1);
});

test('cohorts: only one cohort can be active at a time', async () => {
  await seedCohort();
  await assert.rejects(
    () =>
      query(
        `INSERT INTO cohorts (slug, name, starts_on, is_active)
         VALUES ('second', 'Second', now()::date, true)`
      ),
    (err) => err.code === '23505'
  );
});
