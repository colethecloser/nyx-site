-- Seed the first cohort and its 8 weekly deliverables.
-- Idempotent: re-running only fills gaps, it never duplicates or overwrites.

-- `is_active` is claimed only when no other cohort holds it. Without this the
-- insert trips the `cohorts_one_active` unique index — which `ON CONFLICT
-- (slug)` does not cover — and the whole migration fails with a confusing
-- duplicate-key error on any database that already has a live cohort.
INSERT INTO cohorts (slug, name, starts_on, ends_on, capacity, applications_open, is_active)
SELECT 'fgcu-fall-2026', 'FGCU Finance Cohort — Fall 2026',
       DATE '2026-09-07', DATE '2026-11-01', 30, true,
       NOT EXISTS (SELECT 1 FROM cohorts WHERE is_active)
ON CONFLICT (slug) DO NOTHING;

WITH c AS (SELECT id, starts_on FROM cohorts WHERE slug = 'fgcu-fall-2026')
INSERT INTO deliverables (cohort_id, week_number, title, description, rubric, points_value, publish_at, due_at)
SELECT c.id, d.week_number, d.title, d.description, d.rubric, d.points_value,
       -- Published Monday 09:00 ET of its week, due the following Sunday 23:59 ET.
       (c.starts_on + ((d.week_number - 1) * 7))::timestamptz + INTERVAL '13 hours',
       (c.starts_on + ((d.week_number - 1) * 7) + 6)::timestamptz + INTERVAL '27 hours 59 minutes'
FROM c, (VALUES
  (1, 'Build your first three-statement model',
      'Pick any S&P 500 company. Build a linked income statement, balance sheet, and cash flow statement from the last three 10-Ks. Hardcode historicals in blue, formulas in black. Submit the file link plus a two-paragraph note on what surprised you.',
      'Statements link and balance (40), historicals accurate to filings (30), formatting discipline (15), written note (15).',
      100),
  (2, 'Write a one-page long thesis',
      'One name, one page. Thesis, three supporting points, the variant perception, and the two things that would prove you wrong. No price target without a stated multiple and the reason for it.',
      'Falsifiable thesis (35), variant perception is genuinely non-consensus (30), risks are specific (20), writing quality (15).',
      100),
  (3, 'Comps and precedent transactions',
      'Assemble a comp set of 6-8 peers for your Week 2 name. Justify every inclusion and every exclusion. Add three precedent transactions with the multiples paid.',
      'Peer selection logic (40), data accuracy (30), multiple math (20), presentation (10).',
      100),
  (4, 'DCF with a defensible WACC',
      'Five-year DCF on your name. You must defend every assumption: revenue build, margin path, capex, WACC components, and terminal method. Include a sensitivity table.',
      'Assumption defensibility (40), model mechanics (25), sensitivity analysis (20), terminal value treatment (15).',
      120),
  (5, 'Teardown of a bad call',
      'Find a published sell-side or fund letter thesis that aged badly. Diagnose the failure: was it the analysis, the timing, or the position sizing? Two pages.',
      'Quality of diagnosis (45), evidence used (30), lessons generalized correctly (25).',
      100),
  (6, 'Stock pitch — live, seven minutes',
      'Present your best idea to the cohort. Seven minutes, then ten minutes of questions from peers. Submit your deck before the session.',
      'Idea quality (30), delivery (25), handling of Q&A (30), deck (15).',
      150),
  (7, 'Behavioral and technical mock',
      'Paired mock interview with an assigned cohort partner. Twenty technicals, three behaviorals each. Submit your partner scorecard and your own reflection.',
      'Technical accuracy (40), story structure (30), quality of feedback given to partner (30).',
      120),
  (8, 'Capstone: the book you would run',
      'Five positions with sizing, a stated mandate, and the risk framework that governs it. Explain what makes you stop out and what makes you add.',
      'Portfolio construction logic (35), position quality (25), risk framework (25), coherence with stated mandate (15).',
      200)
) AS d(week_number, title, description, rubric, points_value)
ON CONFLICT (cohort_id, week_number) DO NOTHING;
