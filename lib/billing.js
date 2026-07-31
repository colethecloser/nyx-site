import { query, queryOne, transaction } from './db.js';
import { createLoginToken } from './auth.js';
import { sendOnce } from './email.js';
import {
  memberWelcome,
  paymentFailed,
  renewalConfirmed,
  subscriptionEnded,
} from './emails/templates.js';
import { firstName } from './applications.js';
import { getStripe, normalizeStatus, subscriptionPeriodEnd, tsToDate } from './stripe.js';
import { siteUrl } from './env.js';
import { formatDate, formatDay, formatMoney } from './format.js';

/**
 * Claim a Stripe event id. Returns false when the event was already handled,
 * which is the whole story of webhook idempotency: Stripe delivers at least
 * once, and retries after a timeout even if the first attempt succeeded.
 */
export async function claimEvent(event) {
  const row = await queryOne(
    `INSERT INTO stripe_events (id, type) VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [event.id, event.type]
  );
  return Boolean(row);
}

export async function finishEvent(eventId, error) {
  await query(
    `UPDATE stripe_events SET processed_at = now(), error = $2 WHERE id = $1`,
    [eventId, error ? String(error).slice(0, 500) : null]
  );
}

/** Release the claim so Stripe's retry gets a real second attempt. */
export async function releaseEvent(eventId) {
  await query(`DELETE FROM stripe_events WHERE id = $1`, [eventId]);
}

export async function handleStripeEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed':
      return onCheckoutCompleted(event.data.object);
    case 'invoice.paid':
    case 'invoice.payment_succeeded':
      return onInvoicePaid(event.data.object);
    case 'invoice.payment_failed':
      return onInvoicePaymentFailed(event.data.object);
    case 'customer.subscription.updated':
    case 'customer.subscription.created':
      return onSubscriptionChanged(event.data.object);
    case 'customer.subscription.deleted':
      return onSubscriptionDeleted(event.data.object);
    default:
      return { handled: false, type: event.type };
  }
}

// ---------------------------------------------------------------------------

async function onCheckoutCompleted(session) {
  if (session.mode !== 'subscription') return { handled: false, reason: 'not a subscription' };
  if (session.payment_status === 'unpaid') return { handled: false, reason: 'unpaid' };

  const stripe = getStripe();
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  if (!subscriptionId) return { handled: false, reason: 'no subscription on session' };

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const email =
    session.customer_details?.email || session.customer_email || subscription.metadata?.member_email;

  const applicationId = session.metadata?.application_id || session.client_reference_id || null;

  const { member, created } = await enrol({
    applicationId,
    email,
    customerId,
    subscription,
  });

  if (!member) return { handled: false, reason: 'could not resolve member' };

  // Welcome mail carries a sign-in link so the first visit needs no password
  // and no separate "check your email" round trip.
  const token = await createLoginToken(member.email);
  const tpl = memberWelcome({
    name: firstName(member.full_name),
    cohortName: member.cohort_name,
    startsOn: formatDay(member.cohort_starts_on, { weekday: 'long', month: 'long', day: 'numeric' }),
    loginUrl: `${siteUrl()}/api/auth/verify?token=${encodeURIComponent(token)}`,
  });
  await sendOnce({
    to: member.email,
    template: 'member_welcome',
    dedupeKey: `member:${member.id}:welcome`,
    ...tpl,
  });

  return { handled: true, memberId: member.id, created };
}

/**
 * Create (or re-activate) the member and burn the invite, atomically.
 *
 * Written to be safe when Stripe replays the event or when a member who
 * previously cancelled pays again: the members upsert keys on email, and the
 * application transition is guarded by `FOR UPDATE`.
 */
async function enrol({ applicationId, email, customerId, subscription }) {
  const status = normalizeStatus(subscription.status);
  const periodEnd = subscriptionPeriodEnd(subscription);

  return transaction(async (client) => {
    let application = null;

    if (applicationId) {
      application = await client
        .query(`SELECT * FROM applications WHERE id = $1 FOR UPDATE`, [applicationId])
        .then((r) => r.rows[0] ?? null);
    }
    if (!application && email) {
      application = await client
        .query(
          `SELECT * FROM applications
            WHERE email = $1 AND status IN ('accepted', 'enrolled')
            ORDER BY created_at DESC LIMIT 1
            FOR UPDATE`,
          [email]
        )
        .then((r) => r.rows[0] ?? null);
    }

    // Fall back to the active cohort so a payment is never dropped on the floor
    // just because we lost the link back to an application.
    const cohortId =
      application?.cohort_id ||
      (await client
        .query(`SELECT id FROM cohorts WHERE is_active ORDER BY starts_on LIMIT 1`)
        .then((r) => r.rows[0]?.id ?? null));

    const memberEmail = email || application?.email;
    if (!memberEmail || !cohortId) return { member: null, created: false };

    if (application) {
      await client.query(
        `UPDATE applications
            SET status = 'enrolled',
                invite_used_at = COALESCE(invite_used_at, now()),
                invite_token_hash = NULL,
                updated_at = now()
          WHERE id = $1`,
        [application.id]
      );
    }

    const before = await client
      .query(`SELECT id FROM members WHERE email = $1`, [memberEmail])
      .then((r) => r.rows[0] ?? null);

    const member = await client
      .query(
        `INSERT INTO members (application_id, cohort_id, email, full_name,
                              stripe_customer_id, stripe_subscription_id,
                              sub_status, current_period_end)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (email) DO UPDATE
           SET stripe_customer_id     = EXCLUDED.stripe_customer_id,
               stripe_subscription_id = EXCLUDED.stripe_subscription_id,
               sub_status             = EXCLUDED.sub_status,
               current_period_end     = EXCLUDED.current_period_end,
               cancel_at_period_end   = false,
               application_id         = COALESCE(members.application_id, EXCLUDED.application_id)
         RETURNING *`,
        [
          application?.id ?? null,
          cohortId,
          memberEmail,
          application?.full_name || memberEmail.split('@')[0],
          customerId ?? null,
          subscription.id,
          status,
          periodEnd,
        ]
      )
      .then((r) => r.rows[0]);

    const cohort = await client
      .query(`SELECT name, starts_on FROM cohorts WHERE id = $1`, [cohortId])
      .then((r) => r.rows[0]);

    return {
      member: { ...member, cohort_name: cohort?.name, cohort_starts_on: cohort?.starts_on },
      created: !before,
    };
  });
}

// ---------------------------------------------------------------------------

/**
 * Enrol an accepted applicant with no payment step.
 *
 * Used when COHORT_PRICE_CENTS is 0. Stripe refuses a zero-amount subscription,
 * so a free group cannot simply be "checkout with a price of nothing" — it has
 * to skip Stripe entirely. Everything else matches the paid path: the invite is
 * burned in the same transaction, and the same welcome email goes out.
 */
export async function enrolFree(application) {
  const result = await transaction(async (client) => {
    const app = await client
      .query(
        `SELECT * FROM applications
          WHERE id = $1 AND status = 'accepted' AND invite_used_at IS NULL
          FOR UPDATE`,
        [application.id]
      )
      .then((r) => r.rows[0] ?? null);
    if (!app) return null;

    await client.query(
      `UPDATE applications
          SET status = 'enrolled', invite_used_at = now(),
              invite_token_hash = NULL, updated_at = now()
        WHERE id = $1`,
      [app.id]
    );

    const member = await client
      .query(
        `INSERT INTO members (application_id, cohort_id, email, full_name, sub_status)
         VALUES ($1, $2, $3, $4, 'active')
         ON CONFLICT (email) DO UPDATE
           SET sub_status = 'active',
               application_id = COALESCE(members.application_id, EXCLUDED.application_id)
         RETURNING *`,
        [app.id, app.cohort_id, app.email, app.full_name]
      )
      .then((r) => r.rows[0]);

    const cohort = await client
      .query(`SELECT name, starts_on FROM cohorts WHERE id = $1`, [app.cohort_id])
      .then((r) => r.rows[0]);

    return { ...member, cohort_name: cohort?.name, cohort_starts_on: cohort?.starts_on };
  });

  if (!result) return null;

  const token = await createLoginToken(result.email);
  const tpl = memberWelcome({
    name: firstName(result.full_name),
    cohortName: result.cohort_name,
    startsOn: formatDay(result.cohort_starts_on, { weekday: 'long', month: 'long', day: 'numeric' }),
    loginUrl: `${siteUrl()}/api/auth/verify?token=${encodeURIComponent(token)}`,
  });
  await sendOnce({
    to: result.email,
    template: 'member_welcome',
    dedupeKey: `member:${result.id}:welcome`,
    ...tpl,
  }).catch((err) => console.error('[billing] free welcome email failed:', err.message));

  return result;
}

async function onInvoicePaid(invoice) {
  const subscriptionId = subscriptionIdFrom(invoice);
  const member = await findMember({ subscriptionId, customerId: customerIdFrom(invoice) });
  // The very first invoice can land before checkout.session.completed. There is
  // nothing to update yet, and the checkout handler reads live subscription
  // state, so dropping this is correct rather than merely tolerable.
  if (!member) return { handled: false, reason: 'no member yet' };

  let periodEnd = null;
  let status = 'active';
  if (subscriptionId) {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    periodEnd = subscriptionPeriodEnd(subscription);
    status = normalizeStatus(subscription.status);
  }

  await query(
    `UPDATE members
        SET sub_status = $2::subscription_status,
            current_period_end = COALESCE($3, current_period_end),
            stripe_subscription_id = COALESCE(stripe_subscription_id, $4)
      WHERE id = $1`,
    [member.id, status, periodEnd, subscriptionId ?? null]
  );

  if (invoice.billing_reason === 'subscription_cycle') {
    const tpl = renewalConfirmed({
      name: firstName(member.full_name),
      amountLabel: formatMoney(invoice.amount_paid ?? 0, invoice.currency ?? 'usd'),
      periodEndLabel: formatDate(periodEnd, { month: 'long', day: 'numeric', year: 'numeric' }),
    });
    await sendOnce({
      to: member.email,
      template: 'renewal_confirmed',
      dedupeKey: `invoice:${invoice.id}:renewed`,
      ...tpl,
    });
  }

  return { handled: true, memberId: member.id };
}

async function onInvoicePaymentFailed(invoice) {
  const member = await findMember({
    subscriptionId: subscriptionIdFrom(invoice),
    customerId: customerIdFrom(invoice),
  });
  if (!member) return { handled: false, reason: 'no member' };

  await query(
    `UPDATE members SET sub_status = 'past_due' WHERE id = $1 AND sub_status <> 'canceled'`,
    [member.id]
  );

  const nextAttempt = tsToDate(invoice.next_payment_attempt);
  const tpl = paymentFailed({
    name: firstName(member.full_name),
    attemptLabel: nextAttempt
      ? `Stripe will retry automatically on ${formatDate(nextAttempt, { weekday: 'long', month: 'long', day: 'numeric' })}.`
      : 'This was the final automatic retry.',
    billingUrl: `${siteUrl()}/dashboard/billing`,
  });

  // Keyed on the attempt count so each dunning cycle sends exactly one email.
  await sendOnce({
    to: member.email,
    template: 'payment_failed',
    dedupeKey: `invoice:${invoice.id}:failed:${invoice.attempt_count ?? 0}`,
    ...tpl,
  });

  return { handled: true, memberId: member.id };
}

async function onSubscriptionChanged(subscription) {
  const member = await findMember({
    subscriptionId: subscription.id,
    customerId: customerIdFrom(subscription),
  });
  if (!member) return { handled: false, reason: 'no member' };

  await query(
    `UPDATE members
        SET sub_status = $2::subscription_status,
            current_period_end = COALESCE($3, current_period_end),
            cancel_at_period_end = $4,
            stripe_subscription_id = COALESCE(stripe_subscription_id, $5)
      WHERE id = $1`,
    [
      member.id,
      normalizeStatus(subscription.status),
      subscriptionPeriodEnd(subscription),
      Boolean(subscription.cancel_at_period_end),
      subscription.id,
    ]
  );

  return { handled: true, memberId: member.id };
}

async function onSubscriptionDeleted(subscription) {
  const member = await findMember({
    subscriptionId: subscription.id,
    customerId: customerIdFrom(subscription),
  });
  if (!member) return { handled: false, reason: 'no member' };

  await query(
    `UPDATE members SET sub_status = 'canceled', cancel_at_period_end = false WHERE id = $1`,
    [member.id]
  );

  const cohort = await queryOne(`SELECT name FROM cohorts WHERE id = $1`, [member.cohort_id]);
  const tpl = subscriptionEnded({
    name: firstName(member.full_name),
    cohortName: cohort?.name ?? 'the cohort',
  });
  await sendOnce({
    to: member.email,
    template: 'subscription_ended',
    dedupeKey: `sub:${subscription.id}:ended`,
    ...tpl,
  });

  // The freed seat is picked up by the daily waitlist sweep — see
  // app/api/cron/daily/route.js.
  return { handled: true, memberId: member.id };
}

// ---------------------------------------------------------------------------

function subscriptionIdFrom(invoice) {
  if (typeof invoice.subscription === 'string') return invoice.subscription;
  if (invoice.subscription?.id) return invoice.subscription.id;
  // Stripe's newer invoice shape nests the subscription on the line items.
  const line = invoice.lines?.data?.find((l) => l.subscription || l.parent);
  if (typeof line?.subscription === 'string') return line.subscription;
  return line?.parent?.subscription_item_details?.subscription ?? null;
}

function customerIdFrom(obj) {
  return typeof obj.customer === 'string' ? obj.customer : (obj.customer?.id ?? null);
}

async function findMember({ subscriptionId, customerId }) {
  if (subscriptionId) {
    const bySub = await queryOne(`SELECT * FROM members WHERE stripe_subscription_id = $1`, [
      subscriptionId,
    ]);
    if (bySub) return bySub;
  }
  if (customerId) {
    return queryOne(`SELECT * FROM members WHERE stripe_customer_id = $1`, [customerId]);
  }
  return null;
}
