import SetupRunner from '../../../components/cohort/SetupRunner';
import { databaseReachable, isInitialised } from '../../../lib/bootstrap.js';
import { adminEmails, optionalEnv, siteUrl } from '../../../lib/env.js';
import { formatDay } from '../../../lib/format.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Setup — FGCU Finance Cohort',
  robots: { index: false, follow: false },
};

/** A check row. `state` drives the icon; never renders a secret value. */
function Row({ state, label, detail }) {
  const tone = state === 'ok' ? 'ok' : state === 'warn' ? 'warn' : 'bad';
  const glyph = state === 'ok' ? '✓' : state === 'warn' ? '!' : '✗';
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        padding: '11px 0',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <span className={`c-badge ${tone}`} style={{ minWidth: 30, justifyContent: 'center' }}>
        {glyph}
      </span>
      <div>
        <div style={{ fontSize: 14.5 }}>{label}</div>
        {detail && (
          <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 3 }}>{detail}</div>
        )}
      </div>
    </div>
  );
}

const isSet = (name) => Boolean(optionalEnv(name));

export default async function SetupPage() {
  const db = await databaseReachable();
  const state = db.ok ? await isInitialised().catch(() => null) : null;

  const admins = adminEmails();
  const stripe = isSet('STRIPE_SECRET_KEY') && isSet('STRIPE_WEBHOOK_SECRET');
  const email = isSet('RESEND_API_KEY') && isSet('EMAIL_FROM');
  const cron = isSet('CRON_SECRET');

  return (
    <div className="wrap c-page" style={{ maxWidth: 720 }}>
      <div className="c-page-head">
        <div className="c-eyebrow">One-time setup</div>
        <h1>Get the cohort running</h1>
        <p>
          Everything on this page reflects the environment variables on this deployment. Nothing
          here shows a key or a password.
        </p>
      </div>

      <div className="c-panel">
        <h2>Status</h2>
        <div style={{ marginTop: 10 }}>
          <Row
            state={db.ok ? 'ok' : 'bad'}
            label={db.ok ? 'Database connected' : 'Database not reachable'}
            detail={db.ok ? null : 'Set DATABASE_URL in your Vercel project, then redeploy.'}
          />
          <Row
            state={state?.schema ? 'ok' : 'bad'}
            label={state?.schema ? 'Tables created' : 'Tables not created yet'}
            detail={state?.schema ? null : 'The button below creates them.'}
          />
          <Row
            state={state?.cohort ? 'ok' : 'bad'}
            label={state?.cohort ? `Cohort: ${state.cohort.name}` : 'No cohort yet'}
            detail={
              state?.cohort
                ? `Starts ${formatDay(state.cohort.starts_on)} · ${state.cohort.capacity} seats · applications ${state.cohort.applications_open ? 'open' : 'closed'}`
                : null
            }
          />
          <Row
            state={admins.length ? 'ok' : 'bad'}
            label={admins.length ? `Operator: ${admins.join(', ')}` : 'ADMIN_EMAILS is not set'}
            detail={
              admins.length
                ? null
                : 'Set it in Vercel and redeploy — without it nobody can reach /admin.'
            }
          />
          <Row
            state={stripe ? 'ok' : 'warn'}
            label={stripe ? 'Stripe configured' : 'Stripe not configured'}
            detail={stripe ? null : 'Optional for now. Applications work; nobody can pay yet.'}
          />
          <Row
            state={email ? 'ok' : 'warn'}
            label={email ? 'Email configured' : 'Email not configured'}
            detail={
              email ? null : 'Optional for now. Decisions are recorded but nobody is notified.'
            }
          />
          <Row
            state={cron ? 'ok' : 'warn'}
            label={cron ? 'Automation configured' : 'CRON_SECRET not set'}
            detail={cron ? null : 'Optional for now. The weekly and daily jobs will not run.'}
          />
        </div>
      </div>

      <div className="c-panel">
        {db.ok && admins.length > 0 ? (
          // The runner owns "ready", "just finished" and "already set up", so the
          // refresh after a successful run cannot discard the one-time sign-in link.
          <SetupRunner siteUrl={siteUrl()} initiallySetUp={Boolean(state?.cohort)} />
        ) : (
          <>
            <h2>Not ready yet</h2>
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>
              Fix the red items above in your Vercel project settings, redeploy, then reload this
              page. The two that matter are <code>DATABASE_URL</code> and{' '}
              <code>ADMIN_EMAILS</code>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
