# FGCU Finance Cohort — platform

A selective, application-gated cohort platform living alongside the NYX-1
marketing site in the same Next.js app. Students apply, get vetted, pay an
annual subscription, and work through weekly deliverables ranked on a peer
leaderboard.

The design goal was that **nobody has to log in for the thing to run**. Every
recurring action — decisions, invites, reminders, leaderboard recalculation,
waitlist promotion, dunning — happens on its own.

---

## Routes

| Route | Who | What |
|---|---|---|
| `/cohort` | public | Program pitch, live seat count, price |
| `/apply` | public | Application form with the vetting questions |
| `/login` | public | Magic-link sign-in (no passwords) |
| `/join/<token>` | invited | Claim an accepted seat → Stripe Checkout |
| `/join/success` | invited | Stripe's return page |
| `/dashboard` | members | Deliverables, submissions, rank, streak |
| `/dashboard/billing` | members | Subscription status → Stripe portal |
| `/leaderboard` | members | Cohort standings (not public) |
| `/admin` | admins | Review queue, grading, job history |

| API | Auth | Notes |
|---|---|---|
| `POST /api/applications` | public | Rate limited by IP and email |
| `POST /api/auth/request-link` | public | Always answers `{ok:true}` — no user enumeration |
| `GET /api/auth/verify` | token | Single-use, 30-minute magic link |
| `POST /api/auth/logout` | session | |
| `POST /api/checkout` | invite token | The only path to payment |
| `POST /api/stripe/webhook` | signature | Raw-body HMAC + event-id dedupe |
| `POST /api/submissions` | session | |
| `POST /api/billing/portal` | session | Redirects to Stripe's hosted portal |
| `POST /api/admin/applications/[id]` | admin | Override the auto-vetter |
| `POST /api/admin/submissions/[id]` | admin | Grade |
| `GET /api/cron/weekly` | `CRON_SECRET` | Mondays 09:00 ET |
| `GET /api/cron/daily` | `CRON_SECRET` | Daily 10:00 ET |

---

## The funnel

```
apply ─► score (0-100 rubric)
          ├─ ≥ AUTO_ACCEPT_SCORE and a seat is free ──► accepted ─► invite email
          ├─ ≥ AUTO_ACCEPT_SCORE and no seat ─────────► waitlisted
          ├─ < MIN_VIABLE_SCORE ──────────────────────► rejected
          └─ otherwise ───────────────────────────────► under_review (a human)
                                                          │
                        daily cron, after REVIEW_SLA_DAYS ─┘─► accepted / waitlisted

accepted ─► /join/<token> ─► Stripe Checkout ─► webhook ─► member + welcome email
```

**Seats** are consumed by paying members *and* by outstanding invites, so the
auto-accepter cannot hand out more invites than there are chairs. An invite that
is never claimed expires, the application moves to `withdrawn`, the seat frees,
and the daily job promotes the top of the waitlist into it.

### Scoring

`scoreApplication` in `lib/applications.js` is a pure function, so a decision can
always be explained back to an applicant, and it is unit tested. It weights
*demonstrated thinking* over credentials:

| Component | Max | Rewards |
|---|---|---|
| Thesis answer | 35 | Numbers, a named variant perception, stated disconfirming evidence |
| Motivation | 15 | Substance (saturating — long ≠ good) |
| Hours committed | 15 | ≥8h full marks |
| Experience | 15 | Deliberately capped so a beginner can still win |
| GPA | 10 | |
| Brokerage account | 5 | |
| LinkedIn / target role | 5 | |

The gap between the thresholds is wide on purpose. Only a clearly strong
application is auto-accepted and only a clearly non-serious one is auto-declined;
everything between goes to a person. `MIN_VIABLE_SCORE` defaults to 25 because an
honest beginner scores in the mid-30s and auto-declining them unread is the one
mistake this funnel cannot take back.

---

## Automation

### `GET /api/cron/weekly` — Mondays 09:00 ET
1. Publishes any deliverable whose `publish_at` has passed, and emails it out.
2. Recomputes points from the submissions ledger and rebuilds streaks.
3. Snapshots the leaderboard for the week, with a week-over-week delta.
4. Emails every active member their standing; emails operators a digest.

### `GET /api/cron/daily` — 10:00 ET
1. Nudges members with an unsubmitted deliverable (twice per deliverable: once a
   few days out, once on the final day).
2. Expires unclaimed invites and frees their seats.
3. Sweeps applications that sat in review past the SLA.
4. Promotes the waitlist into any free seat.
5. Retries failed emails; prunes expired sessions, tokens, and rate-limit rows.

### Why re-running is safe

Three independent mechanisms, all exercised by tests:

- **Email** — every send claims a row in `email_log` keyed by a unique
  `dedupe_key` *before* the provider is called. The loser of a race sends
  nothing. Running the weekly job twice sends zero emails the second time.
- **Stripe** — every event id is claimed in `stripe_events`. A retry of a
  delivered event returns `{duplicate:true}` without re-running the handler. On
  a handler error the claim is released so Stripe's retry gets a real attempt.
- **Concurrency** — each cron holds a Postgres advisory lock, so an overlapping
  invocation exits immediately instead of double-processing.

Every run writes to `job_runs`, surfaced at the bottom of `/admin`, so "did
Monday's email actually go out?" is answerable without reading logs.

### Who appears on the leaderboard

Operators are excluded — from the board, the snapshots, and the weekly "you're
#N" digest. An admin with zero points sitting at the bottom of a student ranking
is noise, and it also inflated the "of N members" denominator everyone else saw.
Admin status is recognised from either the `is_admin` column or the
`ADMIN_EMAILS` allowlist, so both are filtered. An operator's own dashboard says
"Operators are not ranked" rather than showing an empty rank.

---

## Billing

Annual subscription, `COHORT_PRICE_CENTS` (default $199). If `STRIPE_PRICE_ID`
is unset the price is described inline, so the platform runs against a bare
Stripe account with no dashboard setup.

| Event | Effect |
|---|---|
| `checkout.session.completed` | Create/reactivate member, burn the invite, send welcome + sign-in link |
| `invoice.paid` | Extend the period; email a receipt on renewal cycles |
| `invoice.payment_failed` | → `past_due`, dunning email (one per Stripe attempt) |
| `customer.subscription.updated` | Sync status, period end, `cancel_at_period_end` |
| `customer.subscription.deleted` | → `canceled`, access revoked, farewell email |

`past_due` **keeps** access. Stripe is still retrying the card, and locking
someone out mid-dunning is both hostile and bad for recovery. Access is only cut
once Stripe gives up.

The webhook is the only thing that provisions membership — `/join/success` is a
pure confirmation page, because a user can close the tab before it ever loads.

---

## Security

- Sessions and every token (magic link, invite) are random 32-byte values;
  **only their SHA-256 is stored**. Login tokens are single-use, enforced by an
  atomic `UPDATE ... WHERE used_at IS NULL`.
- Session cookies are `httpOnly`, `secure` in production, `SameSite=Lax` — which
  is also what protects the state-changing POSTs from CSRF.
- Webhook signatures are verified against the **raw** request body. Wrong
  secret, tampered body, and stale timestamp are all rejected.
- Cron endpoints require `Authorization: Bearer $CRON_SECRET`, compared in
  constant time.
- Every query is parameterized. Applicant-supplied text is escaped before it
  reaches email HTML.
- `/api/auth/request-link` answers identically for known and unknown addresses.
- Admin access comes from `ADMIN_EMAILS` or `members.is_admin`.
- Errors are logged server-side and returned to clients as generic messages.

---

## Setup

```bash
npm install
cp .env.example .env.local     # placeholder keys are fine for the demo
npm run demo
```

`npm run demo` loads the schema, the cohort, and the demo data, prints a member
and an admin sign-in link, then starts the dev server on
http://localhost:3000/cohort. Paste either link into the browser — they are real
single-use magic links, just printed instead of emailed.

For a specific person, or a fresh link after the 30-minute expiry:

```bash
node scripts/demo-login.js                  # lists members, links the first
node scripts/demo-login.js admin@fgcu.edu   # the admin view
```

| Command | What it loads |
|---|---|
| `npm run db:migrate` | Schema only |
| `npm run db:seed` | Schema + the real first cohort and its 8 deliverables |
| `npm run db:demo` | The above, plus 12 members, graded work, a populated leaderboard, a review queue, and a claimable invite at `/join/demo-invite-token` |

All three are idempotent. `db:demo` is for local exploration only — it refuses
to run against a database that contains real Stripe customers.

Nothing in the demo path talks to Stripe or Resend, so it runs with placeholder
keys.

### Stripe

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`. In production, point a
webhook endpoint at `/api/stripe/webhook` subscribed to:
`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`,
`customer.subscription.updated`, `customer.subscription.deleted`.

### Vercel

`vercel.json` declares both cron schedules. Set `CRON_SECRET` in project env —
Vercel sends it automatically as a bearer token. Cron times are UTC; the
schedules are set for US Eastern.

---

## Tests

```bash
DATABASE_URL=postgres://…/cohort_test npm test
```

Point it at a **throwaway database** — the suite truncates every table between
tests and again on exit.

47 tests. `tests/scoring.test.mjs` is pure logic and needs nothing; the rest run
against a real Postgres — every table is truncated between tests. Stripe and
Resend are stubbed in-process and an unexpected outbound request throws, so the
suite never touches the network.

Coverage is aimed at the parts that would be expensive to get wrong: the whole
accept → pay → enrol funnel, webhook idempotency and replay, dunning, capacity
and waitlist promotion, streak resets, leaderboard ranking and deltas, magic-link
single use, and that every cron job is a no-op the second time.

---

## Notes and limitations

- **Grading is manual.** Submissions get provisional points automatically (full
  on time, half late) and an admin can override with a final grade. There is no
  auto-grader.
- **The vetting rubric is heuristic**, not a language model. It rewards specific
  markers of real analysis. It will occasionally misjudge, which is exactly why
  the middle band goes to a human and why admins can override any decision.
- **Magic links arrive by GET**, so an aggressive link-scanning mail client can
  consume one before the member clicks. The link is single-use and requesting
  another is one click.
- `next@14.2.35` carries published advisories (mostly DoS and cache-poisoning on
  self-hosted deployments). The fix is a major upgrade to Next 16, which is a
  breaking change well outside this work — worth scheduling separately.
