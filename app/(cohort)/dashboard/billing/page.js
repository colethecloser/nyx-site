import { redirect } from 'next/navigation';
import { getCurrentMember } from '../../../../lib/session.js';
import { COHORT_PRICE_CENTS } from '../../../../lib/env.js';
import { formatDate, formatMoney } from '../../../../lib/format.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Billing — FGCU Student Investment Group' };

const STATUS_COPY = {
  active: ['ok', 'Active'],
  trialing: ['ok', 'Trial'],
  past_due: ['bad', 'Payment failed'],
  canceled: ['bad', 'Canceled'],
  unpaid: ['bad', 'Unpaid'],
  incomplete: ['warn', 'Incomplete'],
};

/**
 * Landing page for the "update your card" link in dunning emails. The Stripe
 * portal itself is opened by a POST so the session is re-checked server-side.
 */
export default async function BillingPage() {
  const member = await getCurrentMember();
  if (!member) redirect('/login');

  const [tone, label] = STATUS_COPY[member.sub_status] ?? ['warn', member.sub_status];

  return (
    <div className="wrap c-page" style={{ maxWidth: 560 }}>
      <div className="c-page-head">
        <h1>Billing</h1>
        <p>Card details, invoices, and cancellation all live in Stripe&apos;s portal.</p>
      </div>

      <div className="c-panel">
        <div className="c-meta-list" style={{ marginTop: 0 }}>
          <div>
            <span className="k">Status</span>
            <span className="v"><span className={`c-badge ${tone}`}>{label}</span></span>
          </div>
          <div><span className="k">Membership</span><span className="v">{formatMoney(COHORT_PRICE_CENTS)} / year</span></div>
          <div>
            <span className="k">{member.cancel_at_period_end ? 'Ends' : 'Renews'}</span>
            <span className="v">{formatDate(member.current_period_end)}</span>
          </div>
        </div>

        <form action="/api/billing/portal" method="post" style={{ marginTop: 22 }}>
          <button type="submit" className="c-btn c-btn-primary" disabled={!member.stripe_customer_id}>
            Open billing portal
          </button>
        </form>

        {!member.stripe_customer_id && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--faint)' }}>
            No billing account is linked to this membership yet.
          </p>
        )}
      </div>

      <p style={{ marginTop: 18 }}>
        <a href="/dashboard" style={{ color: 'var(--cyan)', fontSize: 13.5 }}>← Back to dashboard</a>
      </p>
    </div>
  );
}
