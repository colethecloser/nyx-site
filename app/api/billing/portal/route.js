import { NextResponse } from 'next/server';
import { handleError, json } from '../../../../lib/api.js';
import { requireMember } from '../../../../lib/session.js';
import { createBillingPortalSession } from '../../../../lib/stripe.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Hands the member off to Stripe's hosted portal to manage their own card. */
export async function POST() {
  try {
    const member = await requireMember();
    if (!member.stripe_customer_id) {
      return json({ error: 'No billing account is linked to your membership yet.' }, { status: 409 });
    }
    const session = await createBillingPortalSession(member.stripe_customer_id);
    return NextResponse.redirect(session.url, { status: 303 });
  } catch (err) {
    return handleError(err, 'billing.portal');
  }
}
