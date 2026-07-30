import { redirect } from 'next/navigation';
import { hasAccess } from '../../../lib/auth.js';
import { getCurrentMember } from '../../../lib/session.js';
import { getLeaderboard } from '../../../lib/leaderboard.js';
import { queryOne } from '../../../lib/db.js';
import { formatDay } from '../../../lib/format.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Leaderboard — FGCU Finance Cohort',
  robots: { index: false, follow: false },
};

/** Members only: standings name real students and are not public. */
export default async function LeaderboardPage() {
  const member = await getCurrentMember();
  if (!member) redirect('/login');
  if (!hasAccess(member)) redirect('/dashboard');

  const [board, lastSnapshot] = await Promise.all([
    getLeaderboard(member.cohort_id, { limit: 200 }),
    queryOne(
      `SELECT MAX(week_of) AS week_of FROM leaderboard_snapshots WHERE cohort_id = $1`,
      [member.cohort_id]
    ),
  ]);

  return (
    <div className="wrap c-page">
      <div className="c-page-head">
        <div className="c-eyebrow">{member.cohort_name}</div>
        <h1>Leaderboard</h1>
        <p>
          Points come from submitted and graded work. Ties break on streak, then on who joined
          first. Recalculated every Monday morning
          {lastSnapshot?.week_of ? ` — last frozen for the week of ${formatDay(lastSnapshot.week_of)}.` : '.'}
        </p>
      </div>

      {board.length === 0 ? (
        <div className="c-empty">No standings yet. They appear once the first week is graded.</div>
      ) : (
        <div className="c-board">
          <div className="c-board-row c-board-head">
            <div>Rank</div>
            <div>Member</div>
            <div>Points</div>
            <div>Streak</div>
            <div>Last week</div>
          </div>
          {board.map((row) => {
            const isMe = row.id === member.id;
            return (
              <div
                key={row.id}
                className={`c-board-row ${isMe ? 'me' : ''} ${row.rank <= 3 ? 'top' : ''}`}
              >
                <div className="c-board-rank">{String(row.rank).padStart(2, '0')}</div>
                <div className="c-board-name">
                  {row.full_name}
                  {isMe && <span className="you">You</span>}
                </div>
                <div className="c-board-points">{row.points}</div>
                <div>{row.streak_weeks > 0 ? `${row.streak_weeks}w` : '—'}</div>
                <div className={`c-delta ${row.last_delta > 0 ? 'up' : 'flat'}`}>
                  {row.last_delta > 0 ? `+${row.last_delta}` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ marginTop: 22 }}>
        <a href="/dashboard" style={{ color: 'var(--cyan)', fontSize: 13.5 }}>← Back to dashboard</a>
      </p>
    </div>
  );
}
