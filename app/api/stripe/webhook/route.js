import { NextResponse } from 'next/server';
import { getStripe } from '../../../../lib/stripe.js';
import { claimEvent, finishEvent, handleStripeEvent, releaseEvent } from '../../../../lib/billing.js';
import { MissingEnvError, requireEnv } from '../../../../lib/env.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Stripe webhook receiver.
 *
 * Three things matter here and nothing else does:
 *   1. Verify the signature against the *raw* body. `request.text()` is
 *      mandatory — any JSON round-trip changes bytes and breaks the HMAC.
 *   2. Deduplicate on the event id, because Stripe delivers at least once.
 *   3. Return 2xx only when the work is durably done. On failure we release the
 *      dedupe claim and answer 500 so Stripe's retry schedule does its job.
 */
export async function POST(request) {
  let secret;
  try {
    [secret] = requireEnv('STRIPE_WEBHOOK_SECRET');
  } catch (err) {
    if (err instanceof MissingEnvError) {
      console.error('[stripe.webhook] not configured:', err.message);
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }
    throw err;
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const rawBody = await request.text();

  let event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    // Signature failures are the expected shape of an attack, so they are logged
    // without the payload and answered with a flat 400.
    console.warn('[stripe.webhook] signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let claimed = false;
  try {
    claimed = await claimEvent(event);
    if (!claimed) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const result = await handleStripeEvent(event);
    await finishEvent(event.id);
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    console.error(`[stripe.webhook] ${event.type} (${event.id}) failed:`, err);
    if (claimed) {
      // Give the retry a clean slate; a stuck claim would silently swallow the
      // event forever.
      await releaseEvent(event.id).catch((e) =>
        console.error('[stripe.webhook] could not release claim:', e.message)
      );
    }
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }
}
