import { getActiveCohort, seatCounts } from '../../../lib/applications.js';
import { COHORT_PRICE_CENTS, PROGRAM, billingPeriod, isFree } from '../../../lib/env.js';
import { formatDay, formatMoney } from '../../../lib/format.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'FGCU Student Investment Group — apply',
  description:
    'Where analysts are made. Pitch under a live ticker, learn modeling and valuation by doing it. No experience required. All majors welcome.',
};

/**
 * Three distinct states, and the difference matters.
 *
 * `live`  — a cohort row was read; every number on the page is real.
 * `unknown` — no cohort row, or the database is unreachable. The program is
 *   still described from configuration, and crucially we do **not** claim
 *   applications are closed. Saying "closed" because a connection failed is a
 *   false statement to every visitor.
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

/** The four claims that carry the Instagram posts. */
const PROMISES = [
  ['Pitch under a live ticker', 'You present in the trading room, to the room.'],
  ['Training you won’t find in class', 'Modeling, valuation and market analysis, by doing it.'],
  ['All majors welcome', 'Finance, accounting, econ, engineering, anything.'],
  ['Freshmen welcome', 'No experience required. Several of our analysts started at zero.'],
];

const WEEKS = [
  ['Build your first model', 'Three linked statements, from real filings.'],
  ['Write a one-page thesis', 'A view, why the market disagrees, and what would prove you wrong.'],
  ['Comps and precedents', 'Pick a peer set and defend every name in it.'],
  ['Valuation that holds up', 'A DCF where every assumption gets questioned.'],
  ['Take apart a bad call', 'Diagnose why a published thesis failed.'],
  ['Pitch, seven minutes', 'Then ten minutes of questions from the room.'],
  ['Interview reps', 'Technicals and behaviorals, both sides of the table.'],
  ['Your own book', 'Five positions, a mandate, and how you size them.'],
];

export default async function CohortLanding() {
  const { status, cohort, seats } = await loadCohort();
  const free = isFree();
  const price = formatMoney(COHORT_PRICE_CENTS);
  const period = billingPeriod();

  // Applications are only advertised as closed when a cohort actually says so.
  const open = status === 'live' ? Boolean(cohort.applications_open) : true;

  const startsOn = cohort?.starts_on ?? PROGRAM.startsOn;
  const capacity = cohort?.capacity ?? PROGRAM.capacity;
  const cohortName = cohort?.name ?? PROGRAM.name;
  const underway = Boolean(startsOn) && new Date(startsOn) <= new Date();

  return (
    <div className="wrap c-page">
      <div className="c-hero">
        <div className="c-eyebrow">
          FGCU Student Investment Group{startsOn ? ` · ${formatDay(startsOn, { month: 'long', day: undefined, weekday: undefined })}` : ''}
        </div>
        <h1>Where analysts are made.</h1>
      </div>

      <p
        className="c-prose"
        style={{ textAlign: 'center', maxWidth: '52ch', margin: '0 auto 40px', fontSize: 20 }}
      >
        Applications are open. Learn modeling, valuation and market analysis the only way that
        sticks — by doing it, every week, in front of people who will tell you when it is wrong.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 52 }}>
        {open ? (
          <a href="/apply" className="c-btn c-btn-apply">Apply now</a>
        ) : (
          <span className="c-badge warn" style={{ fontSize: 16, padding: '12px 26px' }}>
            Applications are closed for now
          </span>
        )}
      </div>

      <div className="c-grid two" style={{ marginBottom: 18 }}>
        {PROMISES.map(([title, note]) => (
          <div className="c-panel" key={title} style={{ padding: '22px 26px' }}>
            <h3 style={{ marginBottom: 5 }}>{title}</h3>
            <p style={{ color: 'var(--muted)', fontSize: 16.5, margin: 0 }}>{note}</p>
          </div>
        ))}
      </div>

      <div className="c-grid stats" style={{ margin: '34px 0' }}>
        <div className="c-stat">
          <div className="v">{PROGRAM.weeks}</div>
          <div className="l">Weeks</div>
          <div className="sub">One deliverable each</div>
        </div>
        <div className="c-stat">
          <div className="v">{capacity}</div>
          <div className="l">Analysts</div>
          <div className="sub">{seats ? `${seats.seatsLeft} spots left` : 'Per cohort'}</div>
        </div>
        <div className="c-stat">
          <div className="v">{startsOn ? formatDay(startsOn, { year: undefined }) : 'TBA'}</div>
          <div className="l">{underway ? 'Started' : 'Starts'}</div>
          <div className="sub">{cohortName}</div>
        </div>
        <div className="c-stat">
          <div className="v">{free ? 'Free' : price}</div>
          <div className="l">{free ? 'To join' : `Dues ${period.label}`}</div>
          <div className="sub">{free ? 'No dues' : 'Only if you are offered a spot'}</div>
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
            thesis, a teardown, a pitch — and it gets read. By the end you have a portfolio of work
            with your name on it and the reps to talk about it under pressure.
          </p>
          <p>
            The application takes about fifteen minutes. There is a written question about a company
            you find interesting — it is not a test of what you already know, it is how we see how
            you think.
          </p>
        </div>

        <div className="c-panel">
          <h2>What you will do</h2>
          <ol className="c-steps">
            {WEEKS.map(([title, note], i) => (
              <li className="c-step" key={title}>
                <span className="n">{i + 1}</span>
                <div>
                  <h4>{title}</h4>
                  <p>{note}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="c-panel" style={{ marginTop: 18 }}>
        <div className="c-grid two">
          <div className="c-prose">
            <h2>{free ? 'Joining' : 'Club dues'}</h2>
            {free ? (
              <p>
                <strong>Free to join. No dues.</strong> Apply, and if you are offered a spot you
                are in. Weekly review of your work, the analyst leaderboard, and every session in
                the trading room are all included.
              </p>
            ) : (
              <>
                <p>
                  <strong>Club dues are {price} {period.label}.</strong> They cover weekly review of
                  your work, the analyst leaderboard, and every session in the trading room.
                </p>
                <p>
                  <strong>Applying is free.</strong> Dues are only ever charged after you have been
                  offered a spot and accepted it — nothing is taken while your application is being
                  read, and being waitlisted costs nothing.
                </p>
              </>
            )}
            <p style={{ fontSize: 16 }}>
              Questions? Message us on Instagram{' '}
              <a href="https://instagram.com/fgcusig" target="_blank" rel="noopener noreferrer">
                @fgcusig
              </a>
              .
            </p>
          </div>
          <div>
            <div className="c-meta-list" style={{ marginTop: 0 }}>
              <div><span className="k">Application</span><span className="v">Free · 15 min</span></div>
              <div><span className="k">Dues</span><span className="v">{free ? 'None' : `${price} ${period.label}`}</span></div>
              <div><span className="k">You hear back</span><span className="v">Within 3 days</span></div>
              <div><span className="k">Experience needed</span><span className="v">None</span></div>
              <div><span className="k">Open to</span><span className="v">All majors, all years</span></div>
            </div>
            <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {open && <a href="/apply" className="c-btn c-btn-primary">Start your application</a>}
              <a href="/login" className="c-btn c-btn-ghost">Member sign in</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
