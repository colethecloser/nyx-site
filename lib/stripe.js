import Stripe from 'stripe';
import { COHORT_PRICE_CENTS, optionalEnv, requireEnv, siteUrl } from './env.js';

const globalForStripe = globalThis;

export function getStripe() {
  if (!globalForStripe.__stripe) {
    const [key] = requireEnv('STRIPE_SECRET_KEY');
    globalForStripe.__stripe = new Stripe(key, {
      // Pinning the version means a Stripe-side upgrade cannot silently change
      // the shape of the webhook payloads these handlers parse.
      apiVersion: '2025-10-29.clover',
      appInfo: { name: 'FGCU Finance Cohort', version: '1.0.0' },
      maxNetworkRetries: 2,
    });
  }
  return globalForStripe.__stripe;
}

/**
 * A configured Price wins; otherwise the annual price is described inline so
 * the platform runs against a bare Stripe account with no dashboard setup.
 */
function lineItem() {
  const priceId = optionalEnv('STRIPE_PRICE_ID');
  if (priceId) return { price: priceId, quantity: 1 };

  return {
    quantity: 1,
    price_data: {
      currency: 'usd',
      unit_amount: COHORT_PRICE_CENTS,
      recurring: { interval: 'year' },
      product_data: {
        name: 'FGCU Finance Cohort — annual membership',
        description:
          'Eight-week program, weekly deliverable review, peer leaderboard, and access to cohort sessions for one year.',
      },
    },
  };
}

export async function createCheckoutSession({ application, cohort, inviteToken }) {
  const stripe = getStripe();
  return stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      line_items: [lineItem()],
      customer_email: application.email,
      client_reference_id: application.id,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        application_id: application.id,
        cohort_id: cohort.id,
        cohort_slug: cohort.slug,
      },
      subscription_data: {
        metadata: {
          application_id: application.id,
          cohort_id: cohort.id,
          member_email: application.email,
        },
      },
      success_url: `${siteUrl()}/join/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl()}/join/${inviteToken}?canceled=1`,
      // Stripe caps this at 24h from creation; 23 leaves room for clock skew
      // and request latency rather than sitting exactly on the boundary.
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 23,
    },
    // Stripe-side idempotency: a double-clicked "claim seat" button reuses the
    // same session instead of opening two checkouts against one invite.
    { idempotencyKey: `checkout:${application.id}:${application.updated_at?.valueOf?.() ?? ''}` }
  );
}

export async function createBillingPortalSession(customerId) {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl()}/dashboard`,
  });
}

/** Stripe timestamps are seconds; Postgres wants a Date (or null). */
export function tsToDate(seconds) {
  return typeof seconds === 'number' && Number.isFinite(seconds) ? new Date(seconds * 1000) : null;
}

/**
 * Stripe moved `current_period_end` onto subscription items in newer API
 * versions while older accounts still return it at the top level. Read both.
 */
export function subscriptionPeriodEnd(subscription) {
  if (!subscription) return null;
  if (typeof subscription.current_period_end === 'number') {
    return tsToDate(subscription.current_period_end);
  }
  const item = subscription.items?.data?.[0];
  return tsToDate(item?.current_period_end);
}

const KNOWN_STATUSES = new Set([
  'incomplete',
  'active',
  'trialing',
  'past_due',
  'canceled',
  'unpaid',
]);

/**
 * Map Stripe's status vocabulary onto our enum. `incomplete_expired` collapses
 * to `canceled`; anything unrecognised is treated as incomplete rather than
 * blowing up the webhook with an enum violation.
 */
export function normalizeStatus(status) {
  if (status === 'incomplete_expired') return 'canceled';
  if (status === 'paused') return 'unpaid';
  return KNOWN_STATUSES.has(status) ? status : 'incomplete';
}
