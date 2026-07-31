#!/usr/bin/env node
/**
 * Create the first operator account.
 *
 *   node scripts/create-admin.js you@fgcu.edu "Your Name"
 *
 * Why this exists: member rows are created by the Stripe webhook when someone
 * pays. On a brand-new deployment nobody has paid, so there are no members —
 * and because sign-in resolves a session to a member row, the operator has no
 * way into /admin at all. Applications would arrive with nobody able to review
 * them. This bootstraps that first row.
 *
 * The account is marked `is_admin`, so it is excluded from the student
 * leaderboard, and it carries no Stripe subscription — it is an operator seat,
 * not a paid membership.
 *
 * Requires DATABASE_URL. Anyone who can run this already has database
 * credentials, so it grants nothing they did not already have.
 */
const crypto = require('node:crypto');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const email = (process.argv[2] || '').trim().toLowerCase();
  const name = (process.argv[3] || '').trim() || email.split('@')[0];

  if (!email || !email.includes('@')) {
    console.error('Usage: node scripts/create-admin.js <email> ["Full Name"]');
    process.exit(1);
  }

  const needsSsl = !/localhost|127\.0\.0\.1/.test(connectionString) &&
    !/sslmode=disable/.test(connectionString);
  const client = new Client({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: true } : false,
  });
  await client.connect();

  try {
    const cohort = await client
      .query(`SELECT id, name FROM cohorts WHERE is_active ORDER BY starts_on LIMIT 1`)
      .then((r) => r.rows[0]);

    if (!cohort) {
      console.error('No active cohort. Run `npm run db:seed` first.');
      process.exit(1);
    }

    const member = await client
      .query(
        `INSERT INTO members (cohort_id, email, full_name, sub_status, is_admin)
         VALUES ($1, $2, $3, 'active', true)
         ON CONFLICT (email) DO UPDATE SET is_admin = true, full_name = EXCLUDED.full_name
         RETURNING id, email, full_name, (xmax = 0) AS created`,
        [cohort.id, email, name]
      )
      .then((r) => r.rows[0]);

    console.log(
      `\n${member.created ? 'Created' : 'Updated'} operator: ${member.full_name} <${member.email}>`
    );
    console.log(`Cohort: ${cohort.name}\n`);

    // Hand over a working sign-in link so there is no chicken-and-egg with
    // email delivery, which may not be configured yet either.
    const token = crypto.randomBytes(32).toString('base64url');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await client.query(
      `INSERT INTO login_tokens (email, token_hash, expires_at)
       VALUES ($1, $2, now() + INTERVAL '30 minutes')`,
      [member.email, hash]
    );

    const base = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
    console.log('Sign in once with this link (single use, 30 minutes):\n');
    console.log(`  ${base}/api/auth/verify?token=${encodeURIComponent(token)}\n`);
    console.log('After that, /login emails you a link like any other member —');
    console.log('provided this address is also listed in ADMIN_EMAILS.\n');

    const admins = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (admins.length && !admins.includes(email)) {
      console.log(`Note: ${email} is not in ADMIN_EMAILS. The is_admin flag on the`);
      console.log('row still grants access, but adding it there too is clearer.\n');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
