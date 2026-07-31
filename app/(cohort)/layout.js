import '../cohort.css';
import { getCurrentMember } from '../../lib/session.js';

export const metadata = {
  title: 'FGCU Student Investment Group',
  description:
    'A selective, application-gated finance cohort for FGCU students. Weekly deliverables, peer leaderboard, real feedback.',
};

export default async function CohortLayout({ children }) {
  // Nav state depends on the session cookie, so this subtree is always dynamic.
  const member = await getCurrentMember().catch(() => null);

  return (
    <div className="cohort">
      <nav className="c-nav">
        <div className="wrap c-nav-in">
          <a className="c-brand" href="/cohort">
            <span className="mark" /> FGCU Student Investment Group
          </a>
          <div className="c-nav-links">
            {member ? (
              <>
                <a href="/dashboard">Dashboard</a>
                <a href="/leaderboard">Leaderboard</a>
                {member.isAdmin && <a href="/admin">Admin</a>}
                <form action="/api/auth/logout" method="post">
                  <button type="submit" className="c-btn c-btn-ghost c-btn-small">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <a href="/cohort">Program</a>
                <a href="/login">Sign in</a>
                <a href="/apply" className="c-btn c-btn-ghost c-btn-small">
                  Apply
                </a>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>{children}</main>

      <div className="wrap">
        <footer className="c-foot">
          <span>FGCU Student Investment Group · Florida Gulf Coast University</span>
          <span>
            <a href="https://instagram.com/fgcusig" target="_blank" rel="noopener noreferrer">Instagram @fgcusig</a>
            {' · '}
            <a href="/apply">Apply</a> · <a href="/login">Sign in</a>
          </span>
        </footer>
      </div>
    </div>
  );
}
