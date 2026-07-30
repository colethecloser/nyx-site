import LoginForm from '../../../components/cohort/LoginForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Sign in — FGCU Finance Cohort' };

const ERRORS = {
  expired: 'That sign-in link has expired or was already used. Request a new one below.',
  unknown: 'We could not find a membership for that address.',
};

export default function LoginPage({ searchParams }) {
  const notice = ERRORS[searchParams?.error];

  return (
    <div className="wrap c-page" style={{ maxWidth: 460 }}>
      <div className="c-page-head">
        <h1>Sign in</h1>
        <p>No passwords. We email you a single-use link.</p>
      </div>

      {notice && (
        <div className="c-alert bad" role="alert" style={{ marginBottom: 20 }}>
          {notice}
        </div>
      )}

      <div className="c-panel">
        <LoginForm />
      </div>

      <p style={{ marginTop: 20, fontSize: 13.5, color: 'var(--faint)' }}>
        Not a member yet? <a href="/apply" style={{ color: 'var(--cyan)' }}>Apply to the cohort</a>.
      </p>
    </div>
  );
}
