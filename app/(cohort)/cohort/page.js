import { getActiveCohort, seatCounts } from '../../../lib/applications.js';
import { COHORT_PRICE_CENTS, PROGRAM } from '../../../lib/env.js';
import { formatDay, formatMoney } from '../../../lib/format.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'FGCU Finance Cohort — apply',
  description:
    'Eight weeks, thirty seats, one deliverable a week. A selective finance cohort for FGCU students who want the work, not the club.',
};

/**
 * Three distinct states, and the difference matters.
 *
 * `live`  — a cohort row was read; every number on the page is real.
 * `unknown` — no cohort row, or the database is unreachable. The program is
 *   still described from configuration, and crucially we do **not** claim
 *   applications are closed. Saying "closed" because a connection failed is a
 *   false statement to every visitor, and it was the default before this.
 */
async function loadCohort() {
  try {
    const cohort = await getActiveCohort();
    if (!cohort) return { status: 'unknown', cohort: null, seats: null };
    return { status: 'live', cohort, seats: await seatCounts(cohort.id) };
  } catch (err) {
    console.error('[cohort] could not load cohort:', err.message);
    return { status: 'unknown', cohort: null, seats: null };
  }
}

export default async function CohortLanding() {
  const { status, cohort, seats } = await loadCohort();
  const price = formatMoney(COHORT_PRICE_CENTS);

  // Applications are only advertised as closed when a cohort actually says so.
  const open = status === 'live' ? Boolean(cohort.applications_open) : true;

  const startsOn = cohort?.starts_on ?? PROGRAM.startsOn;
  const capacity = cohort?.capacity ?? PROGRAM.capacity;
  const cohortName = cohort?.name ?? PROGRAM.name;

  // A cohort can still be taking applications after it has begun, so the label
  // has to follow the date rather than assume the start is always ahead of us.
  const underway = Boolean(startsOn) && new Date(startsOn) <= new Date();

  return (
    <div className="wrap c-page">
      <div className="c-page-head">
        <div className="c-eyebrow">Florida Gulf Coast University</div>
        <h1>
          Eight weeks of the work
          <br />
          nobody assigns you.
        </h1>
        <p>
          A selective finance cohort for FGCU students. One deliverable a week, read and graded by
          someone who will tell you when it is bad. A leaderboard your peers can see. Thirty seats,
          because past that the feedback stops being real.
        </p>
      </div>

      <div className="c-grid stats" style={{ marginBottom: 34 }}>
        <div className="c-stat">
          <div className="v">{capacity}</div>
          <div className="l">Seats</div>
          <div className="sub">{seats ? `${seats.seatsLeft} still open` : 'Per cohort'}</div>
        </div>
        <div className="c-stat">
          <div className="v">{PROGRAM.weeks}</div>
          <div className="l">Weeks</div>
          <div className="sub">One deliverable each</div>
        </div>
        <div className="c-stat">
          <div className="v">{price}</div>
          <div className="l">Per year</div>
          <div className="sub">Billed annually</div>
        </div>
        <div className="c-stat">
          <div className="v">{startsOn ? formatDay(startsOn, { year: undefined }) : 'TBA'}</div>
          <div className="l">{underway ? 'Started' : 'Starts'}</div>
          <div className="sub">{cohortName}</div>
        </div>
      </div>

      <div className="c-grid two">
        <div className="c-panel c-prose">
          <h2>What this actually is</h2>
          <p>
            Most student finance clubs are a speaker series with a mailing list. You show up, you
            watch, you leave with nothing you can show an interviewer.
          </p>
          <p>
            This is the opposite. <strong>You produce something every week</strong> — a model, a
            thesis, a teardown, a pitch — and it gets read. By week eight you have a portfolio of
            work with your name on it and a record of how you handled being told it was wrong.
          </p>
          <p>
            The application is not a formality. The thesis question is scored on whether you can
            state a view, defend it with numbers, and name what would prove you wrong.
          </p>
        </div>

        <div className="c-panel">
          <h2>The eight weeks</h2>
          <ol className="c-steps" style={{ marginTop: 18 }}>
            {[
              ['Three-statement model', 'Built from filings, not a template.'],
              ['One-page long thesis', 'A view, a variant perception, and your kill criteria.'],
              ['Comps and precedents', 'Defend every inclusion and every exclusion.'],
              ['DCF with a real WACC', 'Every assumption gets challenged.'],
              ['Teardown of a bad call', 'Diagnose why a published thesis failed.'],
              ['Live pitch, seven minutes', 'Then ten minutes of questions from peers.'],
              ['Paired mock interview', 'Twenty technicals, three behaviorals, both directions.'],
              ['Capstone book', 'Five positions, a mandate, and a risk framework.'],
            ].map(([title, note], i) => (
              <li className="c-step" key={title}>
                <span className="n">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h4>{title}</h4>
                  <p>{note}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="c-panel" style={{ marginTop: 16 }}>
        <div className="c-grid two">
          <div className="c-prose">
            <h2>Membership</h2>
            <p>
              <strong>{price} per year.</strong> It covers the full eight-week program, weekly review
              of your deliverables, the peer leaderboard, and access to every cohort session while
              your membership is active. Renews annually; cancel any time from your dashboard.
            </p>
            <p style={{ fontSize: 13.5 }}>
              You are only charged after you are accepted. The application costs nothing, and being
              waitlisted costs nothing.
            </p>
          </div>
          <div>
            <div className="c-meta-list">
              <div><span className="k">Application</span><span className="v">Free</span></div>
              <div><span className="k">Decision</span><span className="v">Within 3 days</span></div>
              <div><span className="k">Membership</span><span className="v">{price}/year</span></div>
              <div><span className="k">Seats left</span><span className="v">{seats ? seats.seatsLeft : `${capacity} per cohort`}</span></div>
            </div>
            <div style={{ marginTop: 22, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {open ? (
                <a href="/apply" className="c-btn c-btn-primary">Start your application</a>
              ) : (
                <span className="c-badge warn">Applications are closed</span>
              )}
              <a href="/login" className="c-btn c-btn-ghost">Member sign in</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
