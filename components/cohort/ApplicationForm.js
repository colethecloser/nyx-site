'use client';

import { useState } from 'react';
import { EXPERIENCE_LABELS, EXPERIENCE_LEVELS, MIN_THESIS_CHARS, MIN_WHY_CHARS } from '../../lib/constants.js';

const INITIAL = {
  full_name: '',
  email: '',
  phone: '',
  grad_year: '',
  major: '',
  gpa: '',
  experience_level: '',
  hours_per_week: '',
  has_brokerage: false,
  target_role: '',
  linkedin_url: '',
  why_join: '',
  recent_thesis: '',
  commitment_note: '',
  referral_source: '',
  agree_terms: false,
};

/** Copy shown after submission, keyed by the decision the API returned. */
const OUTCOMES = {
  accepted: {
    tone: 'ok',
    title: "You're in.",
    body: 'Check your email — it has your invite link and a claim window. The seat is not held indefinitely.',
  },
  waitlisted: {
    tone: 'info',
    title: "You're on the waitlist.",
    body: 'Seats open when accepted applicants let their invite lapse, and the waitlist is worked in order automatically. We will email you if one opens.',
  },
  rejected: {
    tone: 'bad',
    title: 'Not this cohort.',
    body: 'We have emailed you the honest version of why. Applications reopen for the next cohort and reapplying is encouraged.',
  },
  under_review: {
    tone: 'info',
    title: 'Application received.',
    body: 'A human reads every application. You will hear back within three days either way.',
  },
};

export default function ApplicationForm() {
  const [values, setValues] = useState(INITIAL);
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);

  function update(name, value) {
    setValues((v) => ({ ...v, [name]: value }));
    // Clear the server-side error for a field as soon as it is edited.
    setFields((f) => (f[name] ? { ...f, [name]: undefined } : f));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFields(data.fields || {});
        setError(data.error || 'Something went wrong. Please try again.');
        // Send focus to the first field the server rejected.
        const firstBad = Object.keys(data.fields || {})[0];
        if (firstBad) document.getElementById(firstBad)?.focus();
        return;
      }

      setOutcome(OUTCOMES[data.status] ?? OUTCOMES.under_review);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (outcome) {
    return (
      <div className="c-panel" role="status">
        <div className={`c-alert ${outcome.tone}`}>
          <strong style={{ display: 'block', fontSize: 16, marginBottom: 6 }}>{outcome.title}</strong>
          {outcome.body}
        </div>
        <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="/cohort" className="c-btn c-btn-ghost">Back to the program</a>
          <a href="/login" className="c-btn c-btn-ghost">Member sign in</a>
        </div>
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

      <fieldset className="c-fieldset">
        <legend>You</legend>
        <div className="c-form">
          <div className="c-row">
            <Field id="full_name" label="Full name" error={fields.full_name}>
              <input
                id="full_name"
                className="c-input"
                value={values.full_name}
                onChange={(e) => update('full_name', e.target.value)}
                aria-invalid={Boolean(fields.full_name)}
                autoComplete="name"
                required
              />
            </Field>
            <Field
              id="email"
              label="FGCU email"
              hint="Use your @eagle.fgcu.edu address."
              error={fields.email}
            >
              <input
                id="email"
                type="email"
                className="c-input"
                value={values.email}
                onChange={(e) => update('email', e.target.value)}
                aria-invalid={Boolean(fields.email)}
                autoComplete="email"
                required
              />
            </Field>
          </div>

          <div className="c-row three">
            <Field id="grad_year" label="Graduation year" error={fields.grad_year}>
              <input
                id="grad_year"
                type="number"
                className="c-input"
                value={values.grad_year}
                onChange={(e) => update('grad_year', e.target.value)}
                aria-invalid={Boolean(fields.grad_year)}
                min="2024"
                max="2035"
                placeholder="2027"
                required
              />
            </Field>
            <Field id="major" label="Major" error={fields.major}>
              <input
                id="major"
                className="c-input"
                value={values.major}
                onChange={(e) => update('major', e.target.value)}
                aria-invalid={Boolean(fields.major)}
                placeholder="Finance"
                required
              />
            </Field>
            <Field id="gpa" label="GPA" hint="Optional." error={fields.gpa}>
              <input
                id="gpa"
                type="number"
                step="0.01"
                className="c-input"
                value={values.gpa}
                onChange={(e) => update('gpa', e.target.value)}
                aria-invalid={Boolean(fields.gpa)}
                placeholder="3.6"
              />
            </Field>
          </div>

          <div className="c-row">
            <Field id="phone" label="Phone" hint="Optional." error={fields.phone}>
              <input
                id="phone"
                className="c-input"
                value={values.phone}
                onChange={(e) => update('phone', e.target.value)}
                autoComplete="tel"
              />
            </Field>
            <Field id="linkedin_url" label="LinkedIn" hint="Optional." error={fields.linkedin_url}>
              <input
                id="linkedin_url"
                className="c-input"
                value={values.linkedin_url}
                onChange={(e) => update('linkedin_url', e.target.value)}
                aria-invalid={Boolean(fields.linkedin_url)}
                placeholder="https://linkedin.com/in/..."
              />
            </Field>
          </div>
        </div>
      </fieldset>

      <fieldset className="c-fieldset">
        <legend>Where you are</legend>
        <div className="c-form">
          <div className="c-row">
            <Field id="experience_level" label="Experience with markets" error={fields.experience_level}>
              <select
                id="experience_level"
                className="c-select"
                value={values.experience_level}
                onChange={(e) => update('experience_level', e.target.value)}
                aria-invalid={Boolean(fields.experience_level)}
                required
              >
                <option value="">Select one…</option>
                {EXPERIENCE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {EXPERIENCE_LABELS[level]}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              id="hours_per_week"
              label="Hours per week you can commit"
              hint="Be honest. Deliverables take four to six."
              error={fields.hours_per_week}
            >
              <input
                id="hours_per_week"
                type="number"
                className="c-input"
                value={values.hours_per_week}
                onChange={(e) => update('hours_per_week', e.target.value)}
                aria-invalid={Boolean(fields.hours_per_week)}
                min="0"
                max="40"
                placeholder="6"
                required
              />
            </Field>
          </div>

          <div className="c-row">
            <Field id="target_role" label="Role you are aiming at" hint="Optional." error={fields.target_role}>
              <input
                id="target_role"
                className="c-input"
                value={values.target_role}
                onChange={(e) => update('target_role', e.target.value)}
                placeholder="Equity research, IB, buy-side…"
              />
            </Field>
            <Field id="referral_source" label="How did you hear about this?" hint="Optional." error={fields.referral_source}>
              <input
                id="referral_source"
                className="c-input"
                value={values.referral_source}
                onChange={(e) => update('referral_source', e.target.value)}
              />
            </Field>
          </div>

          <label className="c-check">
            <input
              type="checkbox"
              checked={values.has_brokerage}
              onChange={(e) => update('has_brokerage', e.target.checked)}
            />
            <span>I have a brokerage account and have placed at least one trade of my own.</span>
          </label>
        </div>
      </fieldset>

      <fieldset className="c-fieldset">
        <legend>The part that decides it</legend>
        <div className="c-form">
          <Field
            id="recent_thesis"
            label="Walk us through a position you would take right now."
            hint="Name the security. State your view and why the market disagrees. Use numbers. Then name the two things that would prove you wrong. This is scored on specificity, not length — but it cannot be short."
            error={fields.recent_thesis}
            count={[values.recent_thesis.length, MIN_THESIS_CHARS]}
          >
            <textarea
              id="recent_thesis"
              className="c-textarea"
              style={{ minHeight: 220 }}
              value={values.recent_thesis}
              onChange={(e) => update('recent_thesis', e.target.value)}
              aria-invalid={Boolean(fields.recent_thesis)}
              required
            />
          </Field>

          <Field
            id="why_join"
            label="Why this, and why now?"
            hint="What you want out of eight weeks, and what you have already tried on your own."
            error={fields.why_join}
            count={[values.why_join.length, MIN_WHY_CHARS]}
          >
            <textarea
              id="why_join"
              className="c-textarea"
              value={values.why_join}
              onChange={(e) => update('why_join', e.target.value)}
              aria-invalid={Boolean(fields.why_join)}
              required
            />
          </Field>

          <Field
            id="commitment_note"
            label="Anything that could get in the way?"
            hint="Optional. A heavy semester or a job is not disqualifying — being surprised by it in week three is."
            error={fields.commitment_note}
          >
            <textarea
              id="commitment_note"
              className="c-textarea"
              style={{ minHeight: 90 }}
              value={values.commitment_note}
              onChange={(e) => update('commitment_note', e.target.value)}
            />
          </Field>
        </div>
      </fieldset>

      <label className="c-check">
        <input
          type="checkbox"
          checked={values.agree_terms}
          onChange={(e) => update('agree_terms', e.target.checked)}
          aria-invalid={Boolean(fields.agree_terms)}
        />
        <span>
          I understand this is eight weeks of graded work, that missing deliverables resets my
          streak and shows on the analyst leaderboard, and that club dues are charged each
          semester if I am offered a spot and accept it.
        </span>
      </label>
      {fields.agree_terms && <div className="err" style={{ marginTop: -14 }}>{fields.agree_terms}</div>}

      <div>
        <button type="submit" className="c-btn c-btn-primary" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit application'}
        </button>
        <p className="hint" style={{ marginTop: 12, fontSize: 12.5, color: 'var(--faint)' }}>
          Free to apply. You are only charged if you accept a seat.
        </p>
      </div>
    </form>
  );
}

function Field({ id, label, hint, error, count, children }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ');
  return (
    <div className="c-field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      <div aria-describedby={describedBy || undefined}>{children}</div>
      {count && (
        <span className="count">
          {count[0]} / {count[1]} min
        </span>
      )}
      {error && (
        <span className="err" id={`${id}-err`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
