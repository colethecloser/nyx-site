export const TZ = process.env.COHORT_TIMEZONE || 'America/New_York';

export function formatDate(value, opts = {}) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...opts,
  }).format(new Date(value));
}

/**
 * Render a *calendar date* — a Postgres `DATE` or a 'YYYY-MM-DD' string — as
 * itself.
 *
 * `formatDate` is for instants (timestamptz) and converts into the cohort's
 * time zone, which is wrong here: a DATE carries no time of day, and pushing
 * 2026-09-07 through a UTC-4 zone renders it as September 6. Anything that came
 * out of a `date` column belongs in this function, not `formatDate`.
 */
export function formatDay(value, opts = {}) {
  const iso = calendarIso(value);
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...opts,
  }).format(new Date(`${iso}T12:00:00Z`));
}

function calendarIso(value) {
  if (!value) return null;
  if (value instanceof Date) {
    // node-postgres builds DATE values from local calendar components, so the
    // local getters are the ones that hold the intended day.
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(value));
}

export function formatMoney(cents, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** "in 3 days" / "2 days ago" — coarse, which is all the UI needs. */
export function relativeDays(value) {
  if (!value) return '';
  const ms = new Date(value).getTime() - Date.now();
  const days = Math.round(ms / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  if (Math.abs(days) < 1) {
    const hours = Math.round(ms / 3_600_000);
    return rtf.format(hours, 'hour');
  }
  return rtf.format(days, 'day');
}

/** Monday of the week containing `date`, as a YYYY-MM-DD string. */
export function weekOf(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}
