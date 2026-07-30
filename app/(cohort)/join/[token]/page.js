import ClaimSeatButton from '../../../../components/cohort/ClaimSeatButton';
import { queryOne } from '../../../../lib/db.js';
import { hashToken } from '../../../../lib/auth.js';
import { COHORT_PRICE_CENTS } from '../../../../lib/env.js';
import { formatDateTime, formatDay, formatMoney } from '../../../../lib/format.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Claim your seat — FGCU Finance Cohort',
  robots: { index: false, follow: false },
};

/** Looks the invite up by hash — the plaintext token never touches the database. */
async function loadInvite(token) {
  try {
    return await queryOne(
      `SELECT a.id, a.full_name, a.email, a.status, a.invite_expires_at,
              c.name AS cohort_name, c.starts_on, c.ends_on
         FROM applications a
         JOIN cohorts c ON c.id = a.cohort_id
        WHERE a.invite_token_hash = $1
          AND a.status = 'accepted'
          AND a.invite_used_at IS NULL
          AND a.invite_expires_at > now()`,
      [hashToken(token)]
    );
  } catch (err) {
    console.error('[join] invite lookup failed:', err.message);
    return null;
  }
}

export default async function JoinPage({ params, searchParams }) {
  const invite = await loadInvite(params.token);
  const price = formatMoney(COHORT_PRICE_CENTS);

  if (!invite) {
    return (
      <div className="wrap c-page" style={{ maxWidth: 560 }}>
        <div className="c-page-head">
          <h1>This invite is no longer valid</h1>
          <p>
            It may have expired, already been used, or been superseded by a newer one. If you think
            that is wrong, sign in — if your payment went through, your dashboard is already waiting.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="/login" className="c-btn c-btn-primary">Sign in</a>
          <a href="/cohort" className="c-btn c-btn-ghost">Back to the program</a>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap c-page" style={{ maxWidth: 620 }}>
      <div className="c-page-head">
        <div className="c-eyebrow">{invite.cohort_name}</div>
        <h1>{invite.full_name.split(/\s+/)[0]}, your seat is held.</h1>
        <p>
          You were accepted on the strength of your application. Claim the seat below and you are in
          for the full eight weeks.
        </p>
      </div>

      {searchParams?.canceled && (
        <div className="c-alert info" role="status" style={{ marginBottom: 18 }}>
          Checkout was cancelled — nothing was charged. Your seat is still held until the invite
          expires.
        </div>
      )}

      <div className="c-panel">
        <div className="c-meta-list" style={{ marginTop: 0 }}>
          <div><span className="k">Cohort</span><span className="v">{invite.cohort_name}</span></div>
          <div><span className="k">Runs</span><span className="v">{formatDay(invite.starts_on)} – {formatDay(invite.ends_on)}</span></div>
          <div><span className="k">Membership</span><span className="v">{price} / year</span></div>
          <div><span className="k">Invite expires</span><span className="v">{formatDateTime(invite.invite_expires_at)}</span></div>
        </div>

        <div style={{ marginTop: 24 }}>
          <ClaimSeatButton token={params.token} priceLabel={price} />
        </div>
      </div>

      <p style={{ marginTop: 18, fontSize: 13, color: 'var(--faint)', lineHeight: 1.6 }}>
        After the invite expires the seat is released to the waitlist automatically.
      </p>
    </div>
  );
}
