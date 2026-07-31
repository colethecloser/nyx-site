-- ===========================================================================
-- DEMO DATA — for looking at the product, not for production.
--
--   npm run db:demo      (runs schema.sql, seed.sql, then this file)
--
-- Puts the seeded cohort three weeks into its run so every screen has
-- something on it: published deliverables, graded work, a populated
-- leaderboard with streaks and week-over-week deltas, applications waiting in
-- the review queue, and a claimable invite.
--
-- Safe to re-run. It refuses to touch a database that contains real members.
-- ===========================================================================

-- Guard: bail out rather than scribble demo rows over a live cohort.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM members
     WHERE stripe_customer_id IS NOT NULL
       AND stripe_customer_id NOT LIKE 'cus_demo_%'
  ) THEN
    RAISE EXCEPTION
      'Refusing to load demo data: this database has real Stripe customers.';
  END IF;
END $$;

-- Clear only demo-owned rows so re-running is clean.
DELETE FROM submissions WHERE member_id IN (
  SELECT id FROM members WHERE stripe_customer_id LIKE 'cus_demo_%' OR stripe_customer_id IS NULL
);
DELETE FROM leaderboard_snapshots;
DELETE FROM sessions;
DELETE FROM login_tokens;
DELETE FROM members;
DELETE FROM applications;
DELETE FROM email_log;
DELETE FROM job_runs;

-- ---------------------------------------------------------------------------
-- 1. Move the cohort to "week 3 of 8, week 3 still open"
-- ---------------------------------------------------------------------------

-- Drop stray cohorts (a test run can leave one behind) and make sure the
-- seeded cohort is the active one before anything below keys off `is_active`.
DELETE FROM cohorts WHERE slug <> 'fgcu-fall-2026';
UPDATE cohorts SET is_active = true WHERE slug = 'fgcu-fall-2026' AND NOT is_active;

UPDATE cohorts
   SET starts_on = (now() - INTERVAL '17 days')::date,
       ends_on   = (now() + INTERVAL '38 days')::date
 WHERE is_active;

-- Rebuild the schedule off the new start date, using the same Monday-publish /
-- Sunday-due rhythm as the real seed.
UPDATE deliverables d
   SET publish_at = (c.starts_on + ((d.week_number - 1) * 7))::timestamptz + INTERVAL '13 hours',
       due_at     = (c.starts_on + ((d.week_number - 1) * 7) + 6)::timestamptz + INTERVAL '27 hours 59 minutes'
  FROM cohorts c
 WHERE d.cohort_id = c.id AND c.is_active;

-- Anything whose publish time has passed is live.
UPDATE deliverables
   SET published_at = publish_at
 WHERE publish_at <= now();
UPDATE deliverables
   SET published_at = NULL
 WHERE publish_at > now();

-- ---------------------------------------------------------------------------
-- 2. Members
-- ---------------------------------------------------------------------------
INSERT INTO members (cohort_id, email, full_name, stripe_customer_id, stripe_subscription_id,
                     sub_status, current_period_end, is_admin, joined_at)
SELECT c.id, m.email, m.full_name,
       'cus_demo_' || m.slug, 'sub_demo_' || m.slug,
       'active', now() + INTERVAL '348 days', m.is_admin,
       now() - INTERVAL '20 days'
  FROM cohorts c, (VALUES
    ('maya',   'maya.chen@eagle.fgcu.edu',      'Maya Chen',       false),
    ('devin',  'devin.okafor@eagle.fgcu.edu',   'Devin Okafor',    false),
    ('priya',  'priya.raman@eagle.fgcu.edu',    'Priya Raman',     false),
    ('jordan', 'jordan.reyes@eagle.fgcu.edu',   'Jordan Reyes',    false),
    ('aaron',  'aaron.beckett@eagle.fgcu.edu',  'Aaron Beckett',   false),
    ('tess',   'tess.nakamura@eagle.fgcu.edu',  'Tess Nakamura',   false),
    ('luis',   'luis.ferrer@eagle.fgcu.edu',    'Luis Ferrer',     false),
    ('sofia',  'sofia.marin@eagle.fgcu.edu',    'Sofia Marin',     false),
    ('ethan',  'ethan.cole@eagle.fgcu.edu',     'Ethan Cole',      false),
    ('naomi',  'naomi.adeyemi@eagle.fgcu.edu',  'Naomi Adeyemi',   false),
    ('chris',  'chris.vogel@eagle.fgcu.edu',    'Chris Vogel',     false),
    ('admin',  'admin@fgcu.edu',                'Cohort Admin',    true)
  ) AS m(slug, email, full_name, is_admin)
 WHERE c.is_active;

-- One member is mid-dunning, to show the past_due banner without losing access.
UPDATE members SET sub_status = 'past_due' WHERE email = 'chris.vogel@eagle.fgcu.edu';

-- ---------------------------------------------------------------------------
-- 3. Submissions
--
-- Weeks 1-2 are closed and graded; week 3 is open and awaiting grading, which
-- is what fills the admin queue. NULL means the member did not submit — that is
-- what breaks a streak.
-- ---------------------------------------------------------------------------
INSERT INTO submissions (deliverable_id, member_id, url, notes, status, points_awarded,
                         graded_at, graded_by, feedback, submitted_at)
SELECT d.id, mem.id,
       'https://drive.google.com/demo/' || split_part(mem.email, '@', 1) || '-w' || d.week_number,
       s.notes,
       CASE WHEN d.week_number <= 2 THEN 'graded' ELSE 'submitted' END::submission_status,
       s.points,
       CASE WHEN d.week_number <= 2 THEN d.due_at + INTERVAL '2 days' END,
       CASE WHEN d.week_number <= 2 THEN 'admin@fgcu.edu' END,
       CASE WHEN d.week_number <= 2 THEN s.feedback END,
       d.due_at - INTERVAL '6 hours'
  FROM deliverables d
  JOIN cohorts c ON c.id = d.cohort_id AND c.is_active
  JOIN (VALUES
    -- email,                            wk, points, notes, feedback
    ('maya.chen@eagle.fgcu.edu',          1,  95, 'Modeled Costco. The working-capital schedule took three attempts to tie out.', 'Cleanest tie-out in the cohort. Push harder on the revenue build next week.'),
    ('maya.chen@eagle.fgcu.edu',          2,  92, 'Long DECK. Variant view is that the Hoka growth curve is being extrapolated too aggressively.', 'Genuinely non-consensus and you named your kill criteria. More on sizing.'),
    ('maya.chen@eagle.fgcu.edu',          3, 100, 'Comp set of seven. Excluded two on capital-intensity grounds.', NULL),
    ('devin.okafor@eagle.fgcu.edu',       1,  90, 'Built Deere from the 10-Ks. Cash flow bridge was the hard part.', 'Solid mechanics. Your historicals are right; formatting discipline slipped.'),
    ('devin.okafor@eagle.fgcu.edu',       2,  88, 'Short thesis on a staffing name — cyclical peak margins being treated as structural.', 'Good instinct. The variant perception needs a number attached to it.'),
    ('devin.okafor@eagle.fgcu.edu',       3, 100, 'Six peers plus three precedents. Justified every exclusion.', NULL),
    ('priya.raman@eagle.fgcu.edu',        1,  88, 'Modeled Ulta. Learned the hard way that the balance sheet does not balance itself.', 'Right answer, and you found your own error. That is the skill.'),
    ('priya.raman@eagle.fgcu.edu',        2,  85, 'Long thesis on a regional bank. Deposit beta is the whole argument.', 'Focused and falsifiable. Watch the tendency to hedge in the last paragraph.'),
    ('priya.raman@eagle.fgcu.edu',        3, 100, 'Seven comps. Two precedents were hard to find multiples for.', NULL),
    ('jordan.reyes@eagle.fgcu.edu',       1,  82, 'Charter model. My capex assumptions were the weakest part and I know it.', 'Honest self-assessment. Fix the capex build and this is an 8-out-of-10 model.'),
    ('jordan.reyes@eagle.fgcu.edu',       2,  90, 'Long CHTR — rural subscriber losses are being read as structural when they are mix.', 'Best thesis of the week. You named what would prove you wrong, which most did not.'),
    ('jordan.reyes@eagle.fgcu.edu',       3, 100, 'Cable and telco comps. Argued for excluding the satellite names.', NULL),
    ('aaron.beckett@eagle.fgcu.edu',      1,  76, 'First real model I have built. Slow but it balances.', 'It balances, which is the bar. Speed comes later; keep the formatting discipline.'),
    ('aaron.beckett@eagle.fgcu.edu',      2,  84, 'Long a homebuilder. Rate-cut sensitivity is doing a lot of work here.', 'Better. But if the thesis needs rate cuts, say so in the first sentence.'),
    ('aaron.beckett@eagle.fgcu.edu',      3, 100, 'Homebuilder comps. Land banking makes the peer set awkward.', NULL),
    ('tess.nakamura@eagle.fgcu.edu',      1,  88, 'Modeled Chipotle. Unit economics were more interesting than I expected.', 'Strong. Your margin path is defensible, which is rarer than it sounds.'),
    ('tess.nakamura@eagle.fgcu.edu',      2,  80, 'Long a restaurant name. Honestly this one is more consensus than I would like.', 'You spotted the weakness yourself. Next week pick something harder.'),
    ('luis.ferrer@eagle.fgcu.edu',        1,  85, 'Built Tractor Supply. Took me the full weekend.', 'Good work. The historicals are accurate and that is most of the grade.'),
    ('luis.ferrer@eagle.fgcu.edu',        2,  80, 'Long an auto parts retailer. DIY resilience is the crux.', 'Reasonable. Needs a stated multiple and a reason for it.'),
    ('sofia.marin@eagle.fgcu.edu',        1,  50, 'Submitted late — midterms. Model is complete.', 'Complete and correct, but late is half credit. The work itself is good.'),
    ('sofia.marin@eagle.fgcu.edu',        2,  78, 'Long a healthcare distributor. Boring on purpose.', 'Boring is fine. Underwriting is not a creativity contest.'),
    ('ethan.cole@eagle.fgcu.edu',         1,  72, 'Modeled Target. Struggled with the deferred tax line.', 'Fine first attempt. The deferred tax treatment is wrong — see my notes.'),
    ('naomi.adeyemi@eagle.fgcu.edu',      2,  68, 'Joined late so this is my first one. Long an industrial REIT.', 'Good start given you missed week one. The thesis needs more specificity.'),
    ('chris.vogel@eagle.fgcu.edu',        1,  60, 'Got it done but the formatting is rough.', 'Mechanics are there. Formatting discipline is not optional in this seat.')
  ) AS s(email, week_number, points, notes, feedback) ON s.week_number = d.week_number
  JOIN members mem ON mem.email = s.email
 WHERE d.published_at IS NOT NULL;

-- Mark Sofia's week 1 as what it was: late.
UPDATE submissions SET status = 'late'
 WHERE member_id = (SELECT id FROM members WHERE email = 'sofia.marin@eagle.fgcu.edu')
   AND deliverable_id = (SELECT id FROM deliverables WHERE week_number = 1);

-- ---------------------------------------------------------------------------
-- 4. Applications — a funnel in every state
-- ---------------------------------------------------------------------------
INSERT INTO applications (cohort_id, email, full_name, grad_year, major, gpa, experience_level,
                          hours_per_week, has_brokerage, target_role, why_join, recent_thesis,
                          commitment_note, score, score_breakdown, status, waitlist_rank,
                          created_at, decided_at, decided_by)
SELECT c.id, a.email, a.full_name, a.grad_year, a.major, a.gpa, a.experience_level,
       a.hours, a.brokerage, a.target_role, a.why_join, a.thesis, a.commitment,
       a.score, a.breakdown::jsonb, a.status::application_status, a.rank,
       now() - (a.days_ago || ' days')::interval,
       CASE WHEN a.status <> 'under_review' THEN now() - INTERVAL '1 day' END,
       CASE WHEN a.status <> 'under_review' THEN 'auto' END
  FROM cohorts c, (VALUES
    ('rosa.delgado@eagle.fgcu.edu', 'Rosa Delgado', 2028, 'Finance', 3.4, 'beginner', 6, true,
     'Equity research',
     'I have been paper trading for two years and I can pick stocks that go up sometimes, but I cannot explain why in a way that would survive a real question. That is the gap I want closed.',
     'Long Casey''s General Stores. The market prices this as a gas station chain, but the prepared-food business is roughly a third of gross profit and it compounds at a much higher return on capital than the fuel business does. At 24x earnings you are paying a convenience-store multiple for what is closer to a regional QSR. The catalyst is the store remodel program finishing in fiscal 2027. I would be wrong if fuel margins normalize downward faster than food scales, or if the remodels do not lift same-store food sales the way the pilot markets suggested.',
     'Working 15 hours a week at a restaurant but I have Sundays completely free.',
     58, '{"thesis":24,"motivation":9,"commitment":10,"experience":8,"brokerage":5,"gpa":7,"signals":2}',
     'under_review', NULL, 2),

    ('marcus.webb@eagle.fgcu.edu', 'Marcus Webb', 2027, 'Accounting', 3.8, 'intermediate', 5, false,
     'Investment banking',
     'I am an accounting major which means I can read a filing better than most finance majors, but I have never had to form an opinion from one. I want to be pushed to take a position and defend it.',
     'Short a specialty pharmacy name. Receivables have been growing meaningfully faster than revenue for five straight quarters, and days sales outstanding has moved from the high 40s to the low 60s. Either collections are deteriorating or revenue is being recognized aggressively, and management has changed the disclosure twice. The valuation does not reflect either possibility. I would be wrong if the receivable build is genuinely a mix shift toward slower-paying government payors, which management has claimed but not quantified.',
     NULL,
     62, '{"thesis":26,"motivation":9,"commitment":10,"experience":12,"brokerage":0,"gpa":10,"signals":2}',
     'under_review', NULL, 1),

    ('kayla.osei@eagle.fgcu.edu', 'Kayla Osei', 2029, 'Economics', 3.1, 'none', 8, false,
     NULL,
     'I am a sophomore and I know almost nothing yet, which is exactly why I am applying now instead of in two years. I would rather be the worst person in the room and do the work than coast in a club that meets twice a semester.',
     'I do not have a real position yet, so I will be honest about that instead of faking one. If I had to pick, I would look at Dollar General, because the stock has fallen a lot and the stores are always busy where I live. I know that is not a thesis. I know I would need to look at whether the traffic converts to profit per store and whether the shrink problem management keeps mentioning is getting better or worse, and I do not know how to find that out yet. That is what I want to learn.',
     'No conflicts. I have the time and I will use it.',
     37, '{"thesis":11,"motivation":13,"commitment":15,"experience":4,"brokerage":0,"gpa":7,"signals":0}',
     'under_review', NULL, 3),

    ('trevor.lindqvist@eagle.fgcu.edu', 'Trevor Lindqvist', 2027, 'Finance', 3.5, 'intermediate', 7, true,
     'Buy-side',
     'I want the leaderboard honestly. I do better work when someone is keeping score and I can see where I stand against people who are also trying.',
     'Long an aerospace supplier. Aftermarket content per aircraft is rising as the fleet ages and airlines defer replacements, and the market is still modeling this as a cyclical OEM story rather than a recurring-revenue one. Roughly 60 percent of gross profit is aftermarket at a much higher margin. Wrong if OEM production rates recover faster than expected and mix shifts back, or if a supply chain disruption hits the aftermarket parts flow.',
     NULL,
     71, '{"thesis":29,"motivation":8,"commitment":10,"experience":12,"brokerage":5,"gpa":10,"signals":5}',
     'waitlisted', 1, 5),

    ('bianca.ortiz@eagle.fgcu.edu', 'Bianca Ortiz', 2028, 'Finance', 3.3, 'beginner', 5, false,
     'Corporate finance',
     'I want to find out whether I actually like this work before I commit two more years of coursework to it.',
     'Long a regional grocery chain. Private label penetration is increasing which lifts gross margin, and the market treats grocery as a no-growth category so the multiple never moves. The variant view is that private label mix is a margin story, not a volume story, and margin stories re-rate. I would be wrong if the private label push triggers a price war with a larger competitor, or if the margin lift is being spent on labor rather than dropping through.',
     'Heavy course load in the spring.',
     64, '{"thesis":27,"motivation":7,"commitment":10,"experience":8,"brokerage":0,"gpa":7,"signals":5}',
     'waitlisted', 2, 6),

    ('nolan.pierce@eagle.fgcu.edu', 'Nolan Pierce', 2026, 'Business', 2.9, 'none', 2, false,
     NULL,
     'Looking to add something to my resume before I graduate and this seems like it would look good on there.',
     'Stocks generally go up over time so I would buy an index fund and hold it. For individual companies I would look at the ones everyone is talking about like the big tech names because they have the most growth and the best products so they should keep going up.',
     NULL,
     19, '{"thesis":4,"motivation":3,"commitment":0,"experience":4,"brokerage":0,"gpa":1,"signals":0}',
     'rejected', NULL, 8)
  ) AS a(email, full_name, grad_year, major, gpa, experience_level, hours, brokerage, target_role,
         why_join, thesis, commitment, score, breakdown, status, rank, days_ago)
 WHERE c.is_active;

-- The twelve paying members each came through an application.
INSERT INTO applications (cohort_id, email, full_name, grad_year, major, gpa, experience_level,
                          hours_per_week, has_brokerage, why_join, recent_thesis, score,
                          status, created_at, decided_at, decided_by, invite_used_at)
SELECT m.cohort_id, 'alum-' || split_part(m.email, '@', 1) || '@eagle.fgcu.edu', m.full_name,
       2027, 'Finance', 3.5, 'intermediate', 8, true,
       'Enrolled member (demo backfill).',
       'Enrolled member (demo backfill).',
       78, 'enrolled', now() - INTERVAL '25 days', now() - INTERVAL '24 days', 'auto',
       now() - INTERVAL '23 days'
  FROM members m WHERE m.is_admin = false;

-- A live invite you can actually claim: /join/demo-invite-token
-- The plaintext never lives in the database — only this SHA-256, exactly as in
-- production. Predictable on purpose so the demo link is clickable.
INSERT INTO applications (cohort_id, email, full_name, grad_year, major, gpa, experience_level,
                          hours_per_week, has_brokerage, why_join, recent_thesis, score,
                          status, invite_token_hash, invite_expires_at,
                          created_at, decided_at, decided_by)
SELECT c.id, 'harper.quinn@eagle.fgcu.edu', 'Harper Quinn', 2027, 'Finance', 3.7, 'advanced',
       9, true,
       'I interned in equity research last summer and want to keep the reps up during the school year.',
       'Long a payments processor. Take rate compression is priced in but volume growth in the SMB segment is not, and the incremental margin on that volume is close to 70 percent. Wrong if SMB churn accelerates or if a large partner renegotiates.',
       84, 'accepted',
       encode(digest('demo-invite-token', 'sha256'), 'hex'),
       now() + INTERVAL '5 days',
       now() - INTERVAL '2 days', now() - INTERVAL '1 day', 'auto'
  FROM cohorts c WHERE c.is_active;

-- ---------------------------------------------------------------------------
-- 5. Leaderboard history, so the digest deltas have something to compare to
-- ---------------------------------------------------------------------------
UPDATE members m
   SET points = COALESCE((SELECT SUM(s.points_awarded)::int FROM submissions s
                           WHERE s.member_id = m.id), 0);

-- Streak = consecutive closed weeks submitted, counting back from the latest.
WITH closed AS (
  SELECT m.id AS member_id, d.week_number, (s.id IS NOT NULL) AS submitted
    FROM members m
    CROSS JOIN deliverables d
    LEFT JOIN submissions s ON s.deliverable_id = d.id AND s.member_id = m.id
   WHERE d.published_at IS NOT NULL AND d.due_at <= now()
), runs AS (
  SELECT member_id,
         COUNT(*) FILTER (WHERE submitted) AS total_submitted,
         BOOL_AND(submitted) AS all_submitted,
         MAX(week_number) FILTER (WHERE NOT submitted) AS last_gap,
         MAX(week_number) AS last_week
    FROM closed GROUP BY member_id
)
UPDATE members m
   SET streak_weeks = CASE
         WHEN r.all_submitted THEN r.last_week
         WHEN r.last_gap = r.last_week THEN 0
         ELSE r.last_week - r.last_gap
       END
  FROM runs r WHERE m.id = r.member_id;

-- Last week's snapshot, at roughly the points each member had before week 2 was
-- graded, so the leaderboard's "last week" column shows real movement.
INSERT INTO leaderboard_snapshots (cohort_id, member_id, week_of, rank, points, points_delta)
SELECT m.cohort_id, m.id,
       (date_trunc('week', now() - INTERVAL '7 days'))::date,
       RANK() OVER (ORDER BY m.points DESC),
       m.points,
       COALESCE((SELECT s.points_awarded FROM submissions s
                  JOIN deliverables d ON d.id = s.deliverable_id
                 WHERE s.member_id = m.id AND d.week_number = 2), 0)
  FROM members m
 WHERE m.sub_status IN ('active', 'trialing', 'past_due');

-- ---------------------------------------------------------------------------
-- 6. Job history for the admin Automation panel
-- ---------------------------------------------------------------------------
INSERT INTO job_runs (job, started_at, finished_at, ok, summary) VALUES
  ('weekly', now() - INTERVAL '3 days',  now() - INTERVAL '3 days'  + INTERVAL '11 seconds', true,
   '{"cohort":"fgcu-fall-2026","published":[3],"members":12,"announcements":12,"digests":12,"adminDigests":1}'),
  ('daily',  now() - INTERVAL '2 days',  now() - INTERVAL '2 days'  + INTERVAL '3 seconds', true,
   '{"cohort":"fgcu-fall-2026","nudges":4,"expiredInvites":0,"swept":0,"promoted":0}'),
  ('daily',  now() - INTERVAL '1 day',   now() - INTERVAL '1 day'   + INTERVAL '2 seconds', true,
   '{"cohort":"fgcu-fall-2026","nudges":2,"expiredInvites":1,"swept":1,"promoted":1}'),
  ('daily',  now() - INTERVAL '3 hours', now() - INTERVAL '3 hours' + INTERVAL '2 seconds', true,
   '{"cohort":"fgcu-fall-2026","nudges":0,"expiredInvites":0,"swept":0,"promoted":0}');

-- ---------------------------------------------------------------------------
SELECT 'demo data loaded' AS status,
       (SELECT count(*) FROM members)::text      AS members,
       (SELECT count(*) FROM submissions)::text  AS submissions,
       (SELECT count(*) FROM applications)::text AS applications;
