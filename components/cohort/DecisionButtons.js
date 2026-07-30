'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const CHOICES = [
  ['accepted', 'Accept', 'c-btn-primary'],
  ['waitlisted', 'Waitlist', 'c-btn-ghost'],
  ['rejected', 'Decline', 'c-btn-ghost'],
];

/** Admin override of the auto-vetter. The API sends the applicant's email. */
export default function DecisionButtons({ applicationId }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  async function decide(status) {
    if (status === 'rejected' && !window.confirm('Decline this application? The applicant is emailed immediately.')) {
      return;
    }
    setBusy(status);
    setError(null);

    try {
      const response = await fetch(`/api/admin/applications/${applicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Could not record that decision.');
        return;
      }
      setDone(status);
      router.refresh();
    } catch {
      setError('We could not reach the server. Try again.');
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return <span className="c-badge ok">Decision recorded — applicant emailed</span>;
  }

  return (
    <div>
      {error && (
        <div className="c-alert bad" role="alert" style={{ marginBottom: 10 }}>
          {error}
        </div>
      )}
      <div className="c-app-actions">
        {CHOICES.map(([status, label, variant]) => (
          <button
            key={status}
            type="button"
            className={`c-btn ${variant} c-btn-small`}
            onClick={() => decide(status)}
            disabled={Boolean(busy)}
          >
            {busy === status ? 'Saving…' : label}
          </button>
        ))}
      </div>
    </div>
  );
}
