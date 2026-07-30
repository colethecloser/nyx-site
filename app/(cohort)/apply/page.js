import ApplicationForm from '../../../components/cohort/ApplicationForm';
import { getActiveCohort, seatCounts } from '../../../lib/applications.js';
import { COHORT_PRICE_CENTS } from '../../../lib/env.js';
import { formatDay, formatMoney } from '../../../lib/format.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Apply — FGCU Finance Cohort',
  description: 'Application for the FGCU Finance Cohort. Free to apply; you are only charged if you accept a seat.',
};

export default async function ApplyPage() {
  let cohort = null;
  let seats = null;
  let unavailable = false;

  try {
    cohort = await getActiveCohort();
    if (cohort) seats = await seatCounts(cohort.id);
  } catch (err) {
    console.error('[apply] cohort lookup failed:', err.message);
    unavailable = true;
  }

  const closed = !unavailable && (!cohort || !cohort.applications_open);

  return (
    <div className="wrap c-page" style={{ maxWidth: 820 }}>
      <div className="c-page-head">
        <div className="c-eyebrow">{cohort?.name ?? 'Next cohort'}</div>
        <h1>Apply</h1>
        <p>
          Free to apply. Every application is read, and the thesis question is the one that decides
          it. You are only charged {formatMoney(COHORT_PRICE_CENTS)} if you are accepted and claim
          your seat.
        </p>
      </div>

      {cohort && !closed && (
        <div className="c-grid stats" style={{ marginBottom: 26 }}>
          <div className="c-stat">
            <div className="v">{seats?.seatsLeft ?? '—'}</div>
            <div className="l">Seats open</div>
          </div>
          <div className="c-stat">
            <div className="v">{formatDay(cohort.starts_on, { year: undefined })}</div>
            <div className="l">Starts</div>
          </div>
          <div className="c-stat">
            <div className="v">3 days</div>
            <div className="l">To a decision</div>
          </div>
          <div className="c-stat">
            <div className="v">{formatMoney(COHORT_PRICE_CENTS)}</div>
            <div className="l">If accepted</div>
          </div>
        </div>
      )}

      {unavailable && (
        <div className="c-alert bad" role="alert">
          Applications are temporarily unavailable. Please try again shortly.
        </div>
      )}

      {closed && (
        <div className="c-alert info" role="status">
          Applications for this cohort are closed. Watch this page — the next intake opens before the
          following semester.
        </div>
      )}

      {!unavailable && !closed && <ApplicationForm />}
    </div>
  );
}
