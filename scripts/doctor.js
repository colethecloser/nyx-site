#!/usr/bin/env node
/**
 * Pre-launch check: what works right now, and what is still missing.
 *
 *   npm run doctor
 *
 * Grouped by capability rather than by variable, because the useful question
 * on launch night is "how far does this deploy actually get?" — not "is every
 * environment variable set?". The site is designed so each tier degrades on its
 * own: no database still gives you a marketing site, no Stripe still gives you
 * an application funnel, and so on.
 *
 * Only the database check touches the network. Key checks are format-only, so
 * this is safe to run anywhere, including CI.
 */
const { Client } = require('pg');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const OFF = '\x1b[0m';

const tiers = [];

function tier(name, summary) {
  const t = { name, summary, checks: [] };
  tiers.push(t);
  return {
    ok: (label, detail) => t.checks.push({ state: 'ok', label, detail }),
    fail: (label, detail) => t.checks.push({ state: 'fail', label, detail }),
    warn: (label, detail) => t.checks.push({ state: 'warn', label, detail }),
  };
}

const present = (name) => {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() !== '';
};

async function main() {
  // ---- Tier 1: the site itself -------------------------------------------
  const site = tier('The site renders', 'Marketing pages and the program page.');
  site.ok('No configuration required', 'Every page degrades rather than erroring.');
  if (present('NEXT_PUBLIC_SITE_URL')) {
    site.ok('NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL);
  } else {
    site.warn('NEXT_PUBLIC_SITE_URL is unset',
      'Falls back to the Vercel URL. Set it once you have a real domain — email links use it.');
  }

  // ---- Tier 2: applications ----------------------------------------------
  const apps = tier('Applications work', 'Students can apply and be vetted.');
  if (!present('DATABASE_URL')) {
    apps.fail('DATABASE_URL is not set',
      'Create a Postgres database (Neon, Supabase, Vercel Postgres) and set this.');
  } else {
    const url = process.env.DATABASE_URL;
    const needsSsl = !/localhost|127\.0\.0\.1/.test(url) && !/sslmode=disable/.test(url);
    const client = new Client({
      connectionString: url,
      ssl: needsSsl ? { rejectUnauthorized: true } : false,
      connectionTimeoutMillis: 8000,
    });
    try {
      await client.connect();
      apps.ok('Database reachable', redact(url));

      const { rows } = await client.query(
        `SELECT to_regclass('public.cohorts') IS NOT NULL AS has_schema`
      );
      if (!rows[0].has_schema) {
        apps.fail('Schema not applied', 'Run: npm run db:seed');
      } else {
        apps.ok('Schema applied');
        const cohort = await client
          .query(`SELECT name, applications_open, capacity FROM cohorts WHERE is_active LIMIT 1`)
          .then((r) => r.rows[0]);
        if (!cohort) {
          apps.fail('No active cohort', 'Run: npm run db:seed');
        } else {
          apps.ok(`Active cohort: ${cohort.name}`,
            `${cohort.capacity} seats, applications ${cohort.applications_open ? 'open' : 'CLOSED'}`);
          const { rows: d } = await client.query(
            `SELECT count(*)::int AS n FROM deliverables`
          );
          if (d[0].n === 0) apps.warn('No deliverables', 'Run: npm run db:seed');
          else apps.ok(`${d[0].n} deliverables scheduled`);
        }
      }
      await client.end();
    } catch (err) {
      apps.fail('Cannot connect to the database', err.message);
      try { await client.end(); } catch {}
    }
  }

  // ---- Tier 3: payments ---------------------------------------------------
  const pay = tier('Payments work', 'Accepted applicants can claim a seat.');
  checkKey(pay, 'STRIPE_SECRET_KEY', 'sk_', 'Stripe dashboard → Developers → API keys');
  checkKey(pay, 'STRIPE_WEBHOOK_SECRET', 'whsec_',
    'Stripe dashboard → Developers → Webhooks → your endpoint → signing secret');
  if (present('STRIPE_PRICE_ID')) pay.ok('STRIPE_PRICE_ID', process.env.STRIPE_PRICE_ID);
  else pay.ok('STRIPE_PRICE_ID unset', 'Fine — the annual price is created inline.');
  if (/^sk_live_/.test(process.env.STRIPE_SECRET_KEY || '')) {
    pay.warn('Using a LIVE Stripe key', 'Real cards will be charged.');
  }

  // ---- Tier 4: email ------------------------------------------------------
  const mail = tier('Email works', 'Decisions, invites, reminders, receipts.');
  checkKey(mail, 'RESEND_API_KEY', 're_', 'resend.com → API Keys');
  if (present('EMAIL_FROM')) {
    const from = process.env.EMAIL_FROM;
    if (/example\.(com|edu)/.test(from)) {
      mail.fail('EMAIL_FROM is still a placeholder', from);
    } else {
      mail.ok('EMAIL_FROM', from);
    }
  } else {
    mail.fail('EMAIL_FROM is not set', 'Must be an address on a domain verified with Resend.');
  }

  // ---- Tier 5: automation -------------------------------------------------
  const cron = tier('Automation works', 'Weekly and daily jobs run unattended.');
  if (!present('CRON_SECRET')) {
    cron.fail('CRON_SECRET is not set',
      'Generate one: openssl rand -base64 32 — the cron routes 401 without it.');
  } else if (process.env.CRON_SECRET.length < 16) {
    cron.warn('CRON_SECRET is short', 'Use at least 32 characters.');
  } else {
    cron.ok('CRON_SECRET set');
  }
  if (present('ADMIN_EMAILS')) cron.ok('ADMIN_EMAILS', process.env.ADMIN_EMAILS);
  else cron.fail('ADMIN_EMAILS is not set', 'Nobody can reach /admin without this.');

  report();
}

function checkKey(t, name, prefix, where) {
  if (!present(name)) return t.fail(`${name} is not set`, where);
  const value = process.env[name];
  if (!value.startsWith(prefix)) {
    return t.fail(`${name} does not look right`, `Expected it to start with "${prefix}".`);
  }
  t.ok(name, `${value.slice(0, prefix.length + 4)}…`);
}

/** Never print credentials — host and database name are enough to identify it. */
function redact(url) {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return '(unparseable connection string)';
  }
}

function report() {
  console.log(`\n${BOLD}Launch readiness${OFF}\n`);
  let blocked = false;

  for (const t of tiers) {
    const failed = t.checks.filter((c) => c.state === 'fail');
    const mark = failed.length ? `${RED}✗${OFF}` : `${GREEN}✓${OFF}`;
    if (failed.length) blocked = true;

    console.log(`${mark} ${BOLD}${t.name}${OFF} ${DIM}— ${t.summary}${OFF}`);
    for (const c of t.checks) {
      const icon = c.state === 'ok' ? `${GREEN}·${OFF}`
        : c.state === 'warn' ? `${YELLOW}!${OFF}` : `${RED}✗${OFF}`;
      console.log(`    ${icon} ${c.label}${c.detail ? `${DIM}  ${c.detail}${OFF}` : ''}`);
    }
    console.log('');
  }

  const ready = tiers.filter((t) => !t.checks.some((c) => c.state === 'fail'));
  console.log(`${BOLD}${ready.length}/${tiers.length}${OFF} tiers ready.`);
  if (blocked) {
    console.log(`${DIM}Everything above the first ✗ still works — the tiers are independent.${OFF}\n`);
  } else {
    console.log(`${GREEN}Fully configured.${OFF}\n`);
  }
  process.exitCode = 0; // Informational: never fail a build.
}

main().catch((err) => {
  console.error('doctor failed:', err.message);
  process.exitCode = 1;
});
