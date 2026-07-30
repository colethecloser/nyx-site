import test from 'node:test';
import assert from 'node:assert/strict';

import { autoDecisionFor, scoreApplication } from '../lib/applications.js';
import { provisionalPoints } from '../lib/deliverables.js';
import { normalizeStatus, subscriptionPeriodEnd } from '../lib/stripe.js';
import { hashToken, newToken, safeEqual } from '../lib/auth.js';
import { formatDay, weekOf } from '../lib/format.js';
import { validApplication } from './helpers.mjs';

test('scoring: a specific, falsifiable thesis clears the auto-accept bar', () => {
  const { score, breakdown } = scoreApplication(validApplication());
  assert.ok(score >= 70, `expected an auto-accept score, got ${score}`);
  assert.ok(breakdown.thesis >= 25, `thesis should score well, got ${breakdown.thesis}`);
  assert.equal(autoDecisionFor(score, 5), 'accepted');
});

test('scoring: a vague thesis of the same length scores far lower', () => {
  const vague = validApplication({});
  vague.recent_thesis =
    'I like Apple because it is a really good company with strong products and a lot of loyal customers. '.repeat(4);
  const { score } = scoreApplication(vague);
  const strong = scoreApplication(validApplication()).score;
  assert.ok(score < strong - 8, `vague (${score}) should trail specific (${strong}) clearly`);
});

test('scoring: an empty application is auto-declined', () => {
  const { score } = scoreApplication({
    recent_thesis: '',
    why_join: '',
    hours_per_week: 0,
    experience_level: 'none',
    has_brokerage: false,
    gpa: null,
  });
  assert.ok(score < 35, `expected a declining score, got ${score}`);
  assert.equal(autoDecisionFor(score, 30), 'rejected');
});

test('scoring: length alone cannot buy a top score', () => {
  const padded = validApplication();
  padded.recent_thesis = 'words '.repeat(2000);
  const { breakdown } = scoreApplication(padded);
  assert.ok(breakdown.thesis <= 35, 'thesis credit must saturate');
});

test('scoring: a strong candidate with no seats is waitlisted, not accepted', () => {
  const { score } = scoreApplication(validApplication());
  assert.equal(autoDecisionFor(score, 0), 'waitlisted');
});

test('deliverables: late submissions score half credit', () => {
  const past = { due_at: new Date(Date.now() - 86_400_000), points_value: 100 };
  const future = { due_at: new Date(Date.now() + 86_400_000), points_value: 100 };
  assert.deepEqual(provisionalPoints(future), { points: 100, status: 'submitted' });
  assert.deepEqual(provisionalPoints(past), { points: 50, status: 'late' });
});

test('stripe: statuses map onto the database enum', () => {
  assert.equal(normalizeStatus('active'), 'active');
  assert.equal(normalizeStatus('past_due'), 'past_due');
  assert.equal(normalizeStatus('incomplete_expired'), 'canceled');
  assert.equal(normalizeStatus('paused'), 'unpaid');
  assert.equal(normalizeStatus('something_new'), 'incomplete');
});

test('stripe: period end is read from either API shape', () => {
  const seconds = 1_800_000_000;
  assert.equal(subscriptionPeriodEnd({ current_period_end: seconds }).getTime(), seconds * 1000);
  assert.equal(
    subscriptionPeriodEnd({ items: { data: [{ current_period_end: seconds }] } }).getTime(),
    seconds * 1000
  );
  assert.equal(subscriptionPeriodEnd({ items: { data: [] } }), null);
  assert.equal(subscriptionPeriodEnd(null), null);
});

test('tokens: are random, and only the hash is derivable', () => {
  const a = newToken();
  const b = newToken();
  assert.notEqual(a.token, b.token);
  assert.equal(a.hash, hashToken(a.token));
  assert.equal(a.hash.length, 64);
  assert.notEqual(a.hash, a.token);
});

test('safeEqual: matches only on exact equality, including length mismatch', () => {
  assert.equal(safeEqual('secret', 'secret'), true);
  assert.equal(safeEqual('secret', 'secrets'), false);
  assert.equal(safeEqual('secret', 'Secret'), false);
  assert.equal(safeEqual('', ''), true);
  assert.equal(safeEqual(undefined, 'x'), false);
});

test('formatDay: a calendar date renders as itself, not shifted by the cohort zone', () => {
  // The bug this guards: `new Date('2026-09-07')` is midnight UTC, which is
  // September 6 in America/New_York — so a cohort starting Monday the 7th was
  // advertised, and emailed, as the 6th.
  assert.equal(formatDay('2026-09-07'), 'Sep 7, 2026');
  assert.equal(formatDay('2026-01-01'), 'Jan 1, 2026');
  assert.equal(formatDay('2026-12-31'), 'Dec 31, 2026');

  // node-postgres hands back DATE columns as local-midnight Date objects.
  assert.equal(formatDay(new Date(2026, 8, 7)), 'Sep 7, 2026');
  assert.equal(formatDay(new Date(2026, 0, 1)), 'Jan 1, 2026');

  assert.equal(formatDay(null), '—');
  assert.equal(formatDay(undefined), '—');
  assert.equal(formatDay('nonsense'), '—');
});

test('formatDay: honours format options without regaining the offset', () => {
  assert.equal(
    formatDay('2026-09-07', { weekday: 'long', month: 'long', day: 'numeric' }),
    'Monday, September 7, 2026'
  );
  // An explicit `undefined` drops the default rather than reinstating it.
  assert.equal(formatDay('2026-09-07', { year: undefined }), 'Sep 7');
});

test('weekOf: snaps to the Monday of the containing week', () => {
  assert.equal(weekOf(new Date('2026-09-10T12:00:00Z')), '2026-09-07'); // Thursday
  assert.equal(weekOf(new Date('2026-09-07T00:00:00Z')), '2026-09-07'); // Monday
  assert.equal(weekOf(new Date('2026-09-13T23:00:00Z')), '2026-09-07'); // Sunday
  assert.equal(weekOf(new Date('2026-09-14T00:00:00Z')), '2026-09-14'); // next Monday
});

test('scoring: an honest beginner is sent to a human, not auto-declined', () => {
  // Guards the threshold itself. This is a real-shaped application from someone
  // starting out: vague thesis, few hours, no brokerage. It must not be
  // auto-rejected — it belongs in front of a person.
  const beginner = {
    recent_thesis:
      'I think Nvidia will keep going up because AI is a huge trend and everyone needs their chips for data centers. The company has good margins and management seems strong. I would buy it and hold for the long term because the demand is clearly there.',
    why_join:
      'I want to learn how to actually value a company instead of just reading headlines about them.',
    hours_per_week: 4,
    experience_level: 'beginner',
    has_brokerage: false,
    gpa: 3.0,
  };
  const { score } = scoreApplication(beginner);
  assert.ok(score >= 25, `expected a reviewable score, got ${score}`);
  assert.ok(score < 70, `should not auto-accept, got ${score}`);
  assert.equal(autoDecisionFor(score, 30), 'under_review');
});
