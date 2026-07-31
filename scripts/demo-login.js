#!/usr/bin/env node
/**
 * Mint a sign-in link for a member, without sending email.
 *
 *   node scripts/demo-login.js                          # list members, link the first
 *   node scripts/demo-login.js admin@fgcu.edu           # link for a specific member
 *   node scripts/demo-login.js --all                    # one member link + one admin link
 *
 * This is a local convenience for looking at the app with demo data. It uses
 * the same single-use, 30-minute token the real magic-link flow uses — it just
 * prints the URL instead of emailing it. There is no way to bypass auth here
 * that a person with database access did not already have.
 */
const crypto = require('node:crypto');
const { Client } = require('pg');

const TTL_MINUTES = 30;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const wanted = args.find((a) => !a.startsWith('--'));

  const needsSsl = !/localhost|127\.0\.0\.1/.test(connectionString) &&
    !/sslmode=disable/.test(connectionString);
  const client = new Client({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: true } : false,
  });
  await client.connect();

  try {
    const { rows: members } = await client.query(
      `SELECT email, full_name, is_admin, points, sub_status
         FROM members ORDER BY is_admin DESC, points DESC`
    );

    if (!members.length) {
      console.error('No members found. Run `npm run db:demo` first.');
      process.exit(1);
    }

    async function linkFor(m) {
      const token = crypto.randomBytes(32).toString('base64url');
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      await client.query(
        `INSERT INTO login_tokens (email, token_hash, expires_at)
         VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
        [m.email, hash, String(TTL_MINUTES)]
      );
      return `${baseUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
    }

    function describe(m, url) {
      console.log(`\n  ${m.full_name}${m.is_admin ? '  (admin)' : ''}`);
      console.log(`  ${m.email} · ${m.points} points · ${m.sub_status}`);
      console.log(`  ${url}`);
    }

    if (all) {
      const admin = members.find((m) => m.is_admin);
      const student = members.find((m) => !m.is_admin);
      console.log('\nOpen either link to sign in. Single use, expires in 30 minutes.');
      for (const m of [student, admin].filter(Boolean)) describe(m, await linkFor(m));
      console.log('\nAnother member:  node scripts/demo-login.js <email>\n');
      return;
    }

    const member = wanted
      ? members.find((m) => m.email.toLowerCase() === wanted.toLowerCase())
      : members[0];

    if (!member) {
      console.error(`No member with email "${wanted}". Known members:\n`);
      for (const m of members) console.error(`  ${m.email}${m.is_admin ? '  (admin)' : ''}`);
      process.exit(1);
    }

    console.log(`\nSigning in as ${member.full_name}${member.is_admin ? ' (admin)' : ''}`);
    console.log(`${member.email} · ${member.points} points · ${member.sub_status}\n`);
    console.log(`  ${await linkFor(member)}\n`);
    console.log(`Single use, expires in ${TTL_MINUTES} minutes.`);

    if (!wanted) {
      console.log('\nOther members you can sign in as:');
      for (const m of members.slice(1, 6)) {
        console.log(`  node scripts/demo-login.js ${m.email}${m.is_admin ? '   (admin)' : ''}`);
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
