'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SubmissionForm({ deliverableId, existing, locked }) {
  const router = useRouter();
  const [url, setUrl] = useState(existing?.url ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [open, setOpen] = useState(!existing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [saved, setSaved] = useState(false);

  if (locked) {
    return (
      <p style={{ fontSize: 13.5, color: 'var(--faint)' }}>
        This week has been graded and can no longer be edited.
      </p>
    );
  }

  if (!open) {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>
          {saved ? 'Submission updated.' : 'Submitted.'}
        </span>
        <button type="button" className="c-btn c-btn-ghost c-btn-small" onClick={() => setOpen(true)}>
          Edit submission
        </button>
      </div>
    );
  }

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliverable_id: deliverableId, url, notes }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFields(data.fields || {});
        setError(data.error || 'Could not save your submission.');
        return;
      }

      setSaved(true);
      setOpen(false);
      // Points and rank are computed server-side, so refresh rather than guess.
      router.refresh();
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="c-form" onSubmit={onSubmit} noValidate style={{ gap: 16 }}>
      {error && (
        <div className="c-alert bad" role="alert">
          {error}
        </div>
      )}

      <div className="c-field">
        <label htmlFor={`url-${deliverableId}`}>Link to your work</label>
        <span className="hint">
          A shared Google Drive, Dropbox, or Notion link. Make sure it is viewable.
        </span>
        <input
          id={`url-${deliverableId}`}
          className="c-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={Boolean(fields.url)}
          placeholder="https://…"
        />
        {fields.url && <span className="err">{fields.url}</span>}
      </div>

      <div className="c-field">
        <label htmlFor={`notes-${deliverableId}`}>What you did, and where you struggled</label>
        <textarea
          id={`notes-${deliverableId}`}
          className="c-textarea"
          style={{ minHeight: 100 }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          aria-invalid={Boolean(fields.notes)}
          required
        />
        {fields.notes && <span className="err">{fields.notes}</span>}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="c-btn c-btn-primary c-btn-small" disabled={busy}>
          {busy ? 'Saving…' : existing ? 'Update submission' : 'Submit'}
        </button>
        {existing && (
          <button
            type="button"
            className="c-btn c-btn-ghost c-btn-small"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
