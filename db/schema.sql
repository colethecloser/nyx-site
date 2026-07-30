-- FGCU Finance Cohort — schema.
-- Idempotent: safe to run repeatedly (`npm run db:migrate`).

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive email uniqueness

-- ---------------------------------------------------------------------------
-- Cohorts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cohorts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text UNIQUE NOT NULL,
  name           text NOT NULL,
  starts_on      date NOT NULL,
  ends_on        date,
  capacity       integer NOT NULL DEFAULT 30 CHECK (capacity > 0),
  applications_open boolean NOT NULL DEFAULT true,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Exactly one cohort may be the active intake at a time.
CREATE UNIQUE INDEX IF NOT EXISTS cohorts_one_active
  ON cohorts ((is_active)) WHERE is_active;

-- ---------------------------------------------------------------------------
-- Applications
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE application_status AS ENUM (
    'under_review', 'accepted', 'waitlisted', 'rejected', 'enrolled', 'withdrawn'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS applications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id         uuid NOT NULL REFERENCES cohorts(id) ON DELETE RESTRICT,
  email             citext NOT NULL,
  full_name         text NOT NULL,
  phone             text,
  grad_year         integer NOT NULL,
  major             text NOT NULL,
  gpa               numeric(3,2),
  experience_level  text NOT NULL,           -- none | beginner | intermediate | advanced
  hours_per_week    integer NOT NULL,
  has_brokerage     boolean NOT NULL DEFAULT false,
  target_role       text,
  linkedin_url      text,
  -- Vetting free-text
  why_join          text NOT NULL,
  recent_thesis     text NOT NULL,           -- "walk us through a position you'd take"
  commitment_note   text,
  referral_source   text,

  score             integer NOT NULL DEFAULT 0,
  score_breakdown   jsonb NOT NULL DEFAULT '{}'::jsonb,
  status            application_status NOT NULL DEFAULT 'under_review',
  status_reason     text,
  decided_at        timestamptz,
  decided_by        text,                    -- 'auto' or an admin email
  waitlist_rank     integer,

  invite_token_hash text,                    -- sha256 of the accept → checkout token
  invite_expires_at timestamptz,
  invite_used_at    timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- One live application per email per cohort. Withdrawn/rejected rows are kept
-- for history, so the guard is a partial index over the states that "occupy" a
-- seat in the funnel.
CREATE UNIQUE INDEX IF NOT EXISTS applications_active_email_cohort
  ON applications (cohort_id, email)
  WHERE status IN ('under_review', 'accepted', 'waitlisted', 'enrolled');

CREATE INDEX IF NOT EXISTS applications_status_idx ON applications (status, created_at);
CREATE INDEX IF NOT EXISTS applications_invite_idx ON applications (invite_token_hash)
  WHERE invite_token_hash IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM (
    'incomplete', 'active', 'trialing', 'past_due', 'canceled', 'unpaid'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS members (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id         uuid UNIQUE REFERENCES applications(id) ON DELETE SET NULL,
  cohort_id              uuid NOT NULL REFERENCES cohorts(id) ON DELETE RESTRICT,
  email                  citext UNIQUE NOT NULL,
  full_name              text NOT NULL,
  stripe_customer_id     text UNIQUE,
  stripe_subscription_id text UNIQUE,
  sub_status             subscription_status NOT NULL DEFAULT 'incomplete',
  current_period_end     timestamptz,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  points                 integer NOT NULL DEFAULT 0,
  streak_weeks           integer NOT NULL DEFAULT 0,
  is_admin               boolean NOT NULL DEFAULT false,
  joined_at              timestamptz NOT NULL DEFAULT now(),
  last_seen_at           timestamptz
);

CREATE INDEX IF NOT EXISTS members_cohort_points_idx ON members (cohort_id, points DESC);
CREATE INDEX IF NOT EXISTS members_sub_status_idx ON members (sub_status);

-- ---------------------------------------------------------------------------
-- Deliverables + submissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deliverables (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id     uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  week_number   integer NOT NULL CHECK (week_number > 0),
  title         text NOT NULL,
  description   text NOT NULL,
  rubric        text,
  points_value  integer NOT NULL DEFAULT 100 CHECK (points_value >= 0),
  publish_at    timestamptz NOT NULL,
  due_at        timestamptz NOT NULL,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, week_number)
);

CREATE INDEX IF NOT EXISTS deliverables_publish_idx ON deliverables (publish_at)
  WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS deliverables_due_idx ON deliverables (due_at);

DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM ('submitted', 'late', 'graded', 'missed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS submissions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  member_id      uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  url            text,
  notes          text NOT NULL,
  status         submission_status NOT NULL DEFAULT 'submitted',
  points_awarded integer NOT NULL DEFAULT 0 CHECK (points_awarded >= 0),
  graded_at      timestamptz,
  graded_by      text,
  feedback       text,
  submitted_at   timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (deliverable_id, member_id)
);

CREATE INDEX IF NOT EXISTS submissions_member_idx ON submissions (member_id, submitted_at DESC);

-- ---------------------------------------------------------------------------
-- Auth: magic links + sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      citext NOT NULL,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_tokens_email_idx ON login_tokens (email, created_at DESC);

CREATE TABLE IF NOT EXISTS sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  token_hash   text UNIQUE NOT NULL,
  expires_at   timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  user_agent   text
);

CREATE INDEX IF NOT EXISTS sessions_member_idx ON sessions (member_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Automation bookkeeping
-- ---------------------------------------------------------------------------

-- Every automated email is claimed here *before* it is sent. The unique
-- dedupe_key is what makes the cron jobs safe to run twice.
CREATE TABLE IF NOT EXISTS email_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key   text UNIQUE NOT NULL,
  template     text NOT NULL,
  to_email     citext NOT NULL,
  subject      text NOT NULL,
  status       text NOT NULL DEFAULT 'pending',  -- pending | sent | failed
  attempts     integer NOT NULL DEFAULT 0,
  provider_id  text,
  error        text,
  -- Rendered payload is kept so the retry sweep can resend without needing to
  -- reconstruct the template from scratch.
  payload      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz
);

CREATE INDEX IF NOT EXISTS email_log_status_idx ON email_log (status, created_at);

-- Stripe delivers at-least-once; this makes handlers idempotent.
CREATE TABLE IF NOT EXISTS stripe_events (
  id           text PRIMARY KEY,          -- Stripe event id (evt_...)
  type         text NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error        text
);

CREATE TABLE IF NOT EXISTS leaderboard_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id     uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  week_of       date NOT NULL,
  rank          integer NOT NULL,
  points        integer NOT NULL,
  points_delta  integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cohort_id, member_id, week_of)
);

CREATE INDEX IF NOT EXISTS snapshots_week_idx ON leaderboard_snapshots (cohort_id, week_of, rank);

-- Cheap DB-backed rate limiting for unauthenticated POSTs.
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket     text NOT NULL,
  window_start timestamptz NOT NULL,
  count      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

CREATE INDEX IF NOT EXISTS rate_limits_window_idx ON rate_limits (window_start);

-- Audit trail for automated + admin actions.
CREATE TABLE IF NOT EXISTS job_runs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job        text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok         boolean,
  summary    jsonb NOT NULL DEFAULT '{}'::jsonb,
  error      text
);

CREATE INDEX IF NOT EXISTS job_runs_job_idx ON job_runs (job, started_at DESC);
