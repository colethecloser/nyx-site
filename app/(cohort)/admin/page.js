import { redirect } from 'next/navigation';
import DecisionButtons from '../../../components/cohort/DecisionButtons';
import GradeForm from '../../../components/cohort/GradeForm';
import { getCurrentMember } from '../../../lib/session.js';
import { query, queryOne } from '../../../lib/db.js';
import { seatCounts } from '../../../lib/applications.js';
import { APPLICATION_STATUS_LABELS } from '../../../lib/constants.js';
import { formatDate, formatDateTime } from '../../../lib/format.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Admin — FGCU Student Investment Group',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const member = await getCurrentMember();
  if (!member) redirect('/login');
  if (!member.isAdmin) redirect('/dashboard');

  const cohortId = member.cohort_id;

  const [funnel, seats, pending, ungraded, runs] = await Promise.all([
    queryOne(
      `SELECT
         count(*) FILTER (WHERE status = 'under_review')::int AS under_review,
         count(*) FILTER (WHERE status = 'accepted')::int     AS accepted,
         count(*) FILTER (WHERE status = 'waitlisted')::int   AS waitlisted,
         count(*) FILTER (WHERE status = 'enrolled')::int     AS enrolled,
         count(*) FILTER (WHERE status = 'rejected')::int     AS rejected,
         count(*)::int                                        AS total
       FROM applications WHERE cohort_id = $1`,
      [cohortId]
    ),
    seatCounts(cohortId),
    query(
      `SELECT * FROM applications
        WHERE cohort_id = $1 AND status = 'under_review'
        ORDER BY score DESC, created_at ASC
        LIMIT 50`,
      [cohortId]
    ).then((r) => r.rows),
    query(
      `SELECT s.id, s.notes, s.url, s.status, s.points_awarded, s.submitted_at,
              m.full_name, d.week_number, d.title, d.points_value
         FROM submissions s
         JOIN members m ON m.id = s.member_id
         JOIN deliverables d ON d.id = s.deliverable_id
        WHERE m.cohort_id = $1 AND s.status <> 'graded'
        ORDER BY d.week_number DESC, s.submitted_at ASC
        LIMIT 50`,
      [cohortId]
    ).then((r) => r.rows),
    query(
      `SELECT job, started_at, finished_at, ok, summary, error
         FROM job_runs ORDER BY started_at DESC LIMIT 8`
    ).then((r) => r.rows),
  ]);

  return (
    <div className="wrap c-page">
      <div className="c-page-head">
        <div className="c-eyebrow">{member.cohort_name}</div>
        <h1>Admin</h1>
        <p>
          The auto-vetter decides the clear cases on submission. What lands here is what it would not
          call on its own — and anything left for longer than the review window gets swept
          automatically.
        </p>
      </div>

      <div className="c-grid stats" style={{ marginBottom: 16 }}>
        <div className="c-stat">
          <div className="v">{seats.seatsLeft}</div>
          <div className="l">Seats open</div>
          <div className="sub">{seats.filled} paid · {seats.held} invites held</div>
        </div>
        <div className="c-stat">
          <div className="v">{funnel.under_review}</div>
          <div className="l">Awaiting you</div>
        </div>
        <div className="c-stat">
          <div className="v">{funnel.waitlisted}</div>
          <div className="l">Waitlisted</div>
        </div>
        <div className="c-stat">
          <div className="v">{funnel.total}</div>
          <div className="l">Applications</div>
          <div className="sub">{funnel.enrolled} enrolled · {funnel.rejected} declined</div>
        </div>
      </div>

      <section className="c-section" style={{ marginTop: 34 }}>
        <h2 className="c-section-title">Applications to review</h2>
        {pending.length === 0 ? (
          <div className="c-empty">Nothing waiting. The auto-vetter has handled everything.</div>
        ) : (
          pending.map((app) => (
            <article className="c-app-card" key={app.id}>
              <div className="c-app-top">
                <div>
                  <h3>{app.full_name}</h3>
                  <div className="c-app-sub">
                    {app.email} · {app.major}, class of {app.grad_year} ·{' '}
                    {app.hours_per_week}h/wk · applied {formatDate(app.created_at)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="c-app-score">{app.score}<span style={{ fontSize: 13, color: 'var(--faint)' }}>/100</span></div>
                  <span className="c-badge">{APPLICATION_STATUS_LABELS[app.status]}</span>
                </div>
              </div>

              <dl className="c-app-answers">
                <div>
                  <dt>Thesis</dt>
                  <dd>{app.recent_thesis}</dd>
                </div>
                <div>
                  <dt>Why this, why now</dt>
                  <dd>{app.why_join}</dd>
                </div>
                {app.commitment_note && (
                  <div>
                    <dt>Risks to commitment</dt>
                    <dd>{app.commitment_note}</dd>
                  </div>
                )}
                <div>
                  <dt>Score breakdown</dt>
                  <dd>
                    {Object.entries(app.score_breakdown || {})
                      .map(([k, v]) => `${k} ${v}`)
                      .join(' · ')}
                  </dd>
                </div>
              </dl>

              <DecisionButtons applicationId={app.id} />
            </article>
          ))
        )}
      </section>

      <section className="c-section">
        <h2 className="c-section-title">Ungraded submissions</h2>
        {ungraded.length === 0 ? (
          <div className="c-empty">Everything submitted has been graded.</div>
        ) : (
          ungraded.map((s) => (
            <article className="c-app-card" key={s.id}>
              <div className="c-app-top">
                <div>
                  <h3>
                    Week {s.week_number} — {s.full_name}
                  </h3>
                  <div className="c-app-sub">
                    {s.title} · submitted {formatDateTime(s.submitted_at)}
                  </div>
                </div>
                <span className={`c-badge ${s.status === 'late' ? 'warn' : 'info'}`}>
                  {s.status} · {s.points_awarded} pts provisional
                </span>
              </div>

              <dl className="c-app-answers">
                {s.url && (
                  <div>
                    <dt>Work</dt>
                    <dd>
                      <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: 'var(--cyan)' }}>
                        {s.url}
                      </a>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Notes</dt>
                  <dd>{s.notes}</dd>
                </div>
              </dl>

              <GradeForm
                submissionId={s.id}
                maxPoints={s.points_value}
                currentPoints={s.points_awarded}
              />
            </article>
          ))
        )}
      </section>

      <section className="c-section">
        <h2 className="c-section-title">Automation</h2>
        <p style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 14 }}>
          Weekly job runs Mondays 09:00 ET; daily job runs 10:00 ET. Both are idempotent — a rerun
          sends nothing twice.
        </p>
        {runs.length === 0 ? (
          <div className="c-empty">No job has run yet.</div>
        ) : (
          <div className="c-board">
            <div className="c-board-row c-board-head" style={{ gridTemplateColumns: '110px 190px 1fr 90px' }}>
              <div>Job</div>
              <div>Started</div>
              <div>Result</div>
              <div>Status</div>
            </div>
            {runs.map((run, i) => (
              <div className="c-board-row" key={i} style={{ gridTemplateColumns: '110px 190px 1fr 90px' }}>
                <div className="c-board-rank" style={{ fontSize: 13 }}>{run.job}</div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{formatDateTime(run.started_at)}</div>
                <div style={{ fontSize: 12.5, color: 'var(--faint)', fontFamily: 'IBM Plex Mono, monospace' }}>
                  {run.error ? run.error : JSON.stringify(run.summary)}
                </div>
                <div>
                  <span className={`c-badge ${run.ok === true ? 'ok' : run.ok === false ? 'bad' : 'warn'}`}>
                    {run.ok === true ? 'ok' : run.ok === false ? 'failed' : 'running'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
