import { redirect } from 'next/navigation';
import SubmissionForm from '../../../components/cohort/SubmissionForm';
import { hasAccess } from '../../../lib/auth.js';
import { getCurrentMember } from '../../../lib/session.js';
import { listForMember } from '../../../lib/deliverables.js';
import { getStanding } from '../../../lib/leaderboard.js';
import { formatDate, formatDateTime, relativeDays } from '../../../lib/format.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Dashboard — FGCU Finance Cohort' };

export default async function DashboardPage() {
  const member = await getCurrentMember();
  if (!member) redirect('/login');

  if (!hasAccess(member)) {
    return (
      <div className="wrap c-page" style={{ maxWidth: 560 }}>
        <div className="c-page-head">
          <h1>Your membership is not active</h1>
          <p>
            Your standing and every submission are preserved. Restart your membership and they come
            back with you.
          </p>
        </div>
        <form action="/api/billing/portal" method="post">
          <button type="submit" className="c-btn c-btn-primary">Manage billing</button>
        </form>
      </div>
    );
  }

  const [deliverables, standing] = await Promise.all([
    listForMember(member.id, member.cohort_id),
    getStanding(member.id, member.cohort_id),
  ]);

  // "Open" and "outstanding" are different things: a week can still be open
  // while this member has already submitted it. Conflating them told a member
  // who was fully caught up that nothing was open, which is simply untrue.
  const byDueDate = (a, b) => new Date(a.due_at) - new Date(b.due_at);
  const stillOpen = deliverables.filter((d) => new Date(d.due_at) > new Date()).sort(byDueDate);
  const outstanding = stillOpen.filter((d) => !d.submission_id);

  const nextDue = outstanding[0];
  const caughtUpOn = !nextDue ? stillOpen[0] : null;

  return (
    <div className="wrap c-page">
      <div className="c-page-head">
        <div className="c-eyebrow">{member.cohort_name}</div>
        <h1>{member.full_name.split(/\s+/)[0]}</h1>
        <p>
          {nextDue
            ? `Week ${nextDue.week_number} is open and due ${relativeDays(nextDue.due_at)}.`
            : caughtUpOn
              ? `You're caught up. Week ${caughtUpOn.week_number} is submitted and closes ${relativeDays(caughtUpOn.due_at)}.`
              : 'Nothing is open right now. The next deliverable publishes Monday morning.'}
        </p>
      </div>

      {member.sub_status === 'past_due' && (
        <div className="c-alert bad" role="alert" style={{ marginBottom: 22 }}>
          <strong>Your last payment failed.</strong> Stripe is retrying automatically and your access
          is unaffected for now.{' '}
          <form action="/api/billing/portal" method="post" style={{ display: 'inline' }}>
            <button
              type="submit"
              className="c-btn c-btn-ghost c-btn-small"
              style={{ marginLeft: 8 }}
            >
              Update card
            </button>
          </form>
        </div>
      )}

      {member.cancel_at_period_end && (
        <div className="c-alert info" style={{ marginBottom: 22 }}>
          Your membership is set to end on {formatDate(member.current_period_end)}. You keep full
          access until then.
        </div>
      )}

      <div className="c-grid stats" style={{ marginBottom: 30 }}>
        <div className="c-stat">
          <div className="v">{standing.rank ? `#${standing.rank}` : '—'}</div>
          <div className="l">Rank</div>
          <div className="sub">of {standing.total} active members</div>
        </div>
        <div className="c-stat">
          <div className="v">{standing.points}</div>
          <div className="l">Points</div>
          <div className="sub">From graded and submitted work</div>
        </div>
        <div className="c-stat">
          <div className="v">{standing.streak_weeks}</div>
          <div className="l">Week streak</div>
          <div className="sub">{standing.streak_weeks > 0 ? 'Keep it alive' : 'Submit to start one'}</div>
        </div>
        <div className="c-stat">
          <div className="v">{deliverables.filter((d) => d.submission_id).length}/{deliverables.length}</div>
          <div className="l">Submitted</div>
          <div className="sub">Of what has been published</div>
        </div>
      </div>

      <h2 className="c-section-title">Deliverables</h2>

      {deliverables.length === 0 ? (
        <div className="c-empty">
          Nothing has been published yet. Week 1 unlocks when the cohort starts.
        </div>
      ) : (
        deliverables.map((d) => {
          const overdue = !d.submission_id && new Date(d.due_at) < new Date();
          return (
            <article
              key={d.id}
              className={`c-deliverable ${d.submission_id ? 'done' : ''} ${overdue ? 'overdue' : ''}`}
            >
              <div className="c-del-head">
                <div>
                  <div className="c-del-week">WEEK {String(d.week_number).padStart(2, '0')}</div>
                  <h3>{d.title}</h3>
                </div>
                <div className="c-del-meta">
                  <span className={`c-badge ${overdue ? 'bad' : d.submission_id ? 'ok' : 'info'}`}>
                    {d.submission_id
                      ? d.submission_status === 'graded'
                        ? `Graded · ${d.points_awarded} pts`
                        : `${d.submission_status === 'late' ? 'Late' : 'Submitted'} · ${d.points_awarded} pts`
                      : overdue
                        ? 'Missed'
                        : `Due ${relativeDays(d.due_at)}`}
                  </span>
                  <span className="c-badge">{d.points_value} pts</span>
                </div>
              </div>

              <div className="c-del-body">
                <p>{d.description}</p>
                {d.rubric && <div className="c-del-rubric">Graded on: {d.rubric}</div>}
                <div className="c-del-rubric" style={{ borderColor: 'transparent', paddingLeft: 0, marginTop: 10 }}>
                  Due {formatDateTime(d.due_at)}
                </div>
                {d.feedback && (
                  <div className="c-alert ok" style={{ marginTop: 14 }}>
                    <strong style={{ display: 'block', marginBottom: 4 }}>Feedback</strong>
                    {d.feedback}
                  </div>
                )}
              </div>

              <div className="c-del-foot">
                <SubmissionForm
                  deliverableId={d.id}
                  locked={d.submission_status === 'graded'}
                  existing={
                    d.submission_id
                      ? { url: d.submission_url, notes: d.submission_notes }
                      : null
                  }
                />
              </div>
            </article>
          );
        })
      )}

      <div style={{ marginTop: 30, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a href="/leaderboard" className="c-btn c-btn-ghost">See the leaderboard</a>
        <form action="/api/billing/portal" method="post">
          <button type="submit" className="c-btn c-btn-ghost">Manage billing</button>
        </form>
      </div>
    </div>
  );
}
