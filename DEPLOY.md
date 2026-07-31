# Going live

The app is built so each capability works on its own. You do not have to finish
all of this tonight — stop at whatever tier you need.

| Tier | Needs | Without it |
|---|---|---|
| 1. Site is live | nothing | — |
| 2. Applications | `DATABASE_URL` + `npm run db:seed` | Apply page says "temporarily unavailable" |
| 3. Payments | Stripe keys | Accepted applicants cannot claim a seat |
| 4. Email | Resend key | Decisions are recorded but nobody is notified |
| 5. Automation | `CRON_SECRET` | Cron routes return 401 |

Check where you stand at any point:

```bash
npm run doctor
```

---

## Tier 1 — the site (already done)

Vercel is building this repo on every push. With **no environment variables at
all** every route renders: the NYX-1 marketing pages, and `/cohort` describing
the program with its price, curriculum, and seat count from configuration.

`/cohort` deliberately does **not** say "applications are closed" when it cannot
reach a database — it only says that when a real cohort row says so.

Optional, no database required:

```
COHORT_NAME=FGCU Finance Cohort — Fall 2026
COHORT_STARTS_ON=2026-09-07     # otherwise the page shows "TBA"
COHORT_CAPACITY=30
COHORT_WEEKS=8
COHORT_PRICE_CENTS=19900
```

---

## Tier 2 — applications (~5 minutes)

1. Create a Postgres database. [Neon](https://neon.tech) has a free tier and
   gives you a connection string immediately. Vercel Postgres and Supabase work
   the same way.
2. In Vercel → your project → Settings → Environment Variables, add:

   ```
   DATABASE_URL=postgres://…            # include ?sslmode=require for hosted DBs
   NEXT_PUBLIC_SITE_URL=https://your-domain
   ADMIN_EMAILS=you@fgcu.edu
   ```

3. Create the schema and the first cohort. Run this locally, pointed at the
   **same** database:

   ```bash
   DATABASE_URL='postgres://…' npm run db:seed
   ```

   Idempotent — safe to re-run on every deploy.

4. Redeploy so the new variables are picked up.

Applications now work end to end: the form saves, the rubric scores, decisions
are recorded, and `/admin` shows the review queue to anyone in `ADMIN_EMAILS`.
Decision *emails* need tier 4.

> Seed dates are `2026-09-07` → `2026-11-01`. Change them in `db/seed.sql`
> before seeding, or update the `cohorts` row afterwards.

---

## Tier 3 — payments (~10 minutes)

1. Stripe → Developers → API keys → copy the secret key.
2. Stripe → Developers → Webhooks → **Add endpoint**:
   - URL: `https://your-domain/api/stripe/webhook`
   - Events: `checkout.session.completed`, `invoice.paid`,
     `invoice.payment_failed`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - Copy the signing secret.
3. Add to Vercel:

   ```
   STRIPE_SECRET_KEY=sk_live_…          # sk_test_… while you are testing
   STRIPE_WEBHOOK_SECRET=whsec_…
   ```

No product or price setup needed — the $199 annual price is created inline. Set
`STRIPE_PRICE_ID` only if you want to manage it in the dashboard.

Test locally first:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

**The webhook is what grants membership**, not the browser redirect — so it has
to be reachable from the internet. Until it is, payments succeed but nobody
becomes a member.

---

## Tier 4 — email (~15 minutes, DNS is the slow part)

1. [resend.com](https://resend.com) → add your domain → add the DNS records it
   gives you. Verification usually takes a few minutes.
2. Add to Vercel:

   ```
   RESEND_API_KEY=re_…
   EMAIL_FROM=FGCU Finance Cohort <cohort@your-domain>
   ```

`EMAIL_FROM` must be on the verified domain or Resend rejects every send.

Email failures never break a request. A failed send is recorded and retried by
the daily job, so a slow DNS propagation will not lose anyone's decision.

---

## Tier 5 — automation (~1 minute)

```bash
openssl rand -base64 32
```

Add it as `CRON_SECRET`. Vercel sends it automatically as a bearer token to the
schedules already declared in `vercel.json`:

- `/api/cron/weekly` — Mondays 13:00 UTC (09:00 ET)
- `/api/cron/daily` — 14:00 UTC (10:00 ET)

Two cron jobs each firing at most once a day, which fits Vercel's Hobby plan.
Cron times are UTC and do not shift with daylight saving; adjust in `vercel.json`
if the hour matters to you.

Both jobs are safe to run twice — see `docs/cohort-platform.md`.

---

## The full variable list

```
# Tier 2
DATABASE_URL=
NEXT_PUBLIC_SITE_URL=
ADMIN_EMAILS=

# Tier 3
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Tier 4
RESEND_API_KEY=
EMAIL_FROM=

# Tier 5
CRON_SECRET=
```

Everything else in `.env.example` has a working default.

---

## Before you announce it

```bash
npm run doctor          # all five tiers green
```

Then walk the funnel once on the live site with a Stripe test key:

1. Apply at `/apply` with a real FGCU address you can read.
2. Check the decision email arrives.
3. Claim the seat, pay with Stripe's `4242 4242 4242 4242`.
4. Confirm the welcome email arrives and its link signs you in.
5. Submit a deliverable, then check `/leaderboard`.
6. Swap to live Stripe keys.

Set `REQUIRE_FGCU_EMAIL=false` if you ever need to accept a non-FGCU address —
an alum, or yourself while testing.
