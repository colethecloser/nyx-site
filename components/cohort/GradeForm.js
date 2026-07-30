'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function GradeForm({ submissionId, maxPoints, currentPoints }) {
  const router = useRouter();
  const [points, setPoints] = useState(String(currentPoints ?? maxPoints));
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/submissions/${submissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points_awarded: points, feedback }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || 'Could not save the grade.');
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) return <span className="c-badge ok">Graded</span>;

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10, marginTop: 14 }}>
      {error && (
        <div className="c-alert bad" role="alert">
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="c-field" style={{ maxWidth: 130 }}>
          <label htmlFor={`pts-${submissionId}`}>Points (max {maxPoints})</label>
          <input
            id={`pts-${submissionId}`}
            type="number"
            className="c-input"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            min="0"
            max={maxPoints}
            required
          />
        </div>
        <div className="c-field" style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor={`fb-${submissionId}`}>Feedback</label>
          <input
            id={`fb-${submissionId}`}
            className="c-input"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What to fix next week"
          />
        </div>
        <button type="submit" className="c-btn c-btn-primary c-btn-small" disabled={busy}>
          {busy ? 'Saving…' : 'Grade'}
        </button>
      </div>
    </form>
  );
}
