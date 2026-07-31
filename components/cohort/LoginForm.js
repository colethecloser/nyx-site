'use client';

import { useState } from 'react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Could not send the link. Try again.');
        return;
      }
      // The API answers identically for known and unknown addresses, so the UI
      // must not imply whether the account exists.
      setSent(true);
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="c-alert ok" role="status">
        <strong style={{ display: 'block', marginBottom: 6 }}>Check your email.</strong>
        If <span style={{ color: 'var(--ink)' }}>{email}</span> belongs to a member, a sign-in link
        is on its way. It works once and expires in 30 minutes.
      </div>
    );
  }

  return (
    <form className="c-form" onSubmit={onSubmit} noValidate>
      {error && (
        <div className="c-alert bad" role="alert">
          {error}
        </div>
      )}
      <div className="c-field">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          className="c-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@eagle.fgcu.edu"
          required
        />
      </div>
      <div>
        <button type="submit" className="c-btn c-btn-primary" disabled={busy || !email}>
          {busy ? 'Sending…' : 'Email me a sign-in link'}
        </button>
      </div>
    </form>
  );
}
