#!/usr/bin/env node
/**
 * Applies db/schema.sql, then optionally db/seed.sql.
 *
 *   npm run db:migrate        # schema only
 *   npm run db:seed           # schema + the real first cohort
 *   npm run db:demo           # schema + seed + demo data to look at
 *
 * All three files are idempotent, so this is safe to run on every deploy.
 * `--demo` is for local exploration only; demo.sql refuses to run against a
 * database that contains real members.
 */
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const withSeed = process.argv.includes('--seed');
  const withDemo = process.argv.includes('--demo');
  const files = [
    'schema.sql',
    ...(withSeed || withDemo ? ['seed.sql'] : []),
    ...(withDemo ? ['demo.sql'] : []),
  ];

  const needsSsl = !/localhost|127\.0\.0\.1/.test(connectionString) &&
    !/sslmode=disable/.test(connectionString);
  const client = new Client({
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: true } : false,
  });
  await client.connect();

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(__dirname, '..', 'db', file), 'utf8');
      process.stdout.write(`→ applying ${file} ... `);
      await client.query(sql);
      process.stdout.write('ok\n');
    }
    console.log('Database is up to date.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\nMigration failed:', err.message);
  process.exit(1);
});
