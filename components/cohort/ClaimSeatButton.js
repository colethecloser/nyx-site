'use client';

import { useState } from 'react';

/**
 * Exchanges the invite token for a Stripe Checkout URL and forwards the browser.
 * The token is never trusted client-side — the API re-validates it by hash.
 */
export default function ClaimSeatButton({ token, priceLabel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.url) {
        setError(data.error || 'Could not start checkout. Try again.');
        setBusy(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="c-alert bad" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}
      <button type="button" className="c-btn c-btn-primary" onClick={claim} disabled={busy}>
        {busy ? 'Opening checkout…' : `Claim my seat — ${priceLabel}/year`}
      </button>
      <p style={{ marginTop: 12, fontSize: 12.5, color: 'var(--faint)' }}>
        Secure checkout by Stripe. Cancel any time from your dashboard.
      </p>
    </div>
  );
}
