'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Owns every post-database-check state, deliberately.
 *
 * An earlier version let the server branch between "ready to install" and
 * "already set up", and refreshed the page after a successful run. The refresh
 * flipped the server's answer to "already set up", which unmounted this
 * component and took the one-time sign-in link with it — stranding the operator
 * with no way in and no way to reissue it without a shell. So the completed
 * state lives here and outranks everything else.
 */
export default function SetupRunner({ siteUrl, initiallySetUp }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/setup', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Setup failed. Check the deployment logs.');
        return;
      }
      setDone(data);
      // Updates the status list above. Safe now that this component, and the
      // link it is holding, no longer depend on the server's branch.
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const link = done.token
      ? `${siteUrl}/api/auth/verify?token=${encodeURIComponent(done.token)}`
      : null;
    return (
      <div>
        <h2>Setup complete</h2>
        <div className="c-alert ok" role="status" style={{ marginTop: 10 }}>
          <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
            {(done.steps || []).map((s) => (
              <li key={s} style={{ marginBottom: 4 }}>{s}</li>
            ))}
          </ul>
        </div>

        {link ? (
          <div style={{ marginTop: 20 }}>
            <a href={link} className="c-btn c-btn-primary">Open my dashboard</a>
            <p style={{ marginTop: 12, fontSize: 12.5, color: 'var(--faint)', lineHeight: 1.6 }}>
              This link signs you in once and expires in 30 minutes. Use it now — leaving this
              page loses it. Afterwards, <a href="/login" style={{ color: 'var(--cyan)' }}>/login</a>{' '}
              emails you a new one, once email is configured.
            </p>
          </div>
        ) : (
          <p style={{ marginTop: 16, fontSize: 13.5, color: 'var(--muted)' }}>
            Setup ran, but no sign-in link was issued. Open{' '}
            <a href="/login" style={{ color: 'var(--cyan)' }}>/login</a> instead.
          </p>
        )}
      </div>
    );
  }

  if (initiallySetUp) {
    return (
      <div>
        <h2>Already set up</h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16 }}>
          The database is initialised, so this installer is closed. Sign in to review applications.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="/login" className="c-btn c-btn-primary">Sign in</a>
          <a href="/cohort" className="c-btn c-btn-ghost">View the program page</a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Ready to initialise</h2>
      {error && (
        <div className="c-alert bad" role="alert" style={{ margin: '12px 0 16px' }}>
          {error}
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <button type="button" className="c-btn c-btn-primary" onClick={run} disabled={busy}>
          {busy ? 'Setting up…' : 'Set up the database'}
        </button>
        <p style={{ marginTop: 12, fontSize: 12.5, color: 'var(--faint)' }}>
          Creates the tables, the cohort and its eight deliverables, and your operator account.
          Safe to press once. Nothing is deleted.
        </p>
      </div>
    </div>
  );
}
