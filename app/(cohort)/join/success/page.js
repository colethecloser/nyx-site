export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: "You're in — FGCU Finance Cohort",
  robots: { index: false, follow: false },
};

/**
 * Stripe's redirect target. Deliberately does **not** provision anything — the
 * webhook is the only thing that creates a member, because a user can close the
 * tab before this page ever loads.
 */
export default function JoinSuccessPage() {
  return (
    <div className="wrap c-page" style={{ maxWidth: 560 }}>
      <div className="c-page-head">
        <div className="c-eyebrow">Payment confirmed</div>
        <h1>Seat locked.</h1>
        <p>
          Your membership is active. We have emailed you a sign-in link — open it and your dashboard
          is there, with Week 1 waiting when the cohort starts.
        </p>
      </div>

      <div className="c-alert info" style={{ marginBottom: 20 }}>
        The welcome email can take a minute to arrive. If it has not shown up, request a fresh
        sign-in link — your membership is already active either way.
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a href="/login" className="c-btn c-btn-primary">Get a sign-in link</a>
        <a href="/cohort" className="c-btn c-btn-ghost">Back to the program</a>
      </div>
    </div>
  );
}
