import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getPool, queryOne, withAdvisoryLock } from './db.js';
import { adminEmails } from './env.js';

/**
 * First-run setup, runnable from the browser.
 *
 * The alternative was a terminal: `npm run db:seed` followed by
 * `npm run create-admin`. That is a reasonable ask of an engineer and an
 * unreasonable one of the person actually running this program, who has a
 * Vercel dashboard and no shell. Everything here is exactly what those two
 * scripts do — there is no privileged path that the CLI does not also have.
 */

const LOCK_SETUP = 918_452_003;

function sqlFile(name) {
  // Resolved from cwd so Next's file tracing can include db/*.sql in the
  // serverless bundle (see outputFileTracingIncludes in next.config.mjs).
  return fs.readFileSync(path.join(process.cwd(), 'db', name), 'utf8');
}

/** Cheap probe: has the schema ever been applied? */
export async function isInitialised() {
  const row = await queryOne(
    `SELECT to_regclass('public.cohorts') IS NOT NULL AS has_schema`
  );
  if (!row?.has_schema) return { schema: false, cohort: false };
  const cohort = await queryOne(
    `SELECT name, starts_on, capacity, applications_open FROM cohorts WHERE is_active LIMIT 1`
  );
  return { schema: true, cohort: cohort ?? false };
}

/**
 * Apply schema + seed and create operator accounts for every ADMIN_EMAILS
 * address. Idempotent, and serialised by an advisory lock so two cold lambdas
 * hitting it at once cannot race.
 *
 * Returns a plaintext sign-in link for the first operator — the only moment it
 * exists, since only its hash is stored.
 */
export async function runSetup() {
  const { acquired, result } = await withAdvisoryLock(LOCK_SETUP, async (client) => {
    const steps = [];

    const before = await client
      .query(`SELECT to_regclass('public.cohorts') IS NOT NULL AS has_schema`)
      .then((r) => r.rows[0]);

    if (!before.has_schema) {
      await client.query(sqlFile('schema.sql'));
      steps.push('Created the database schema');
    } else {
      // Idempotent, and picks up anything added since the first run.
      await client.query(sqlFile('schema.sql'));
      steps.push('Schema already present, verified up to date');
    }

    const cohortBefore = await client
      .query(`SELECT id FROM cohorts WHERE is_active LIMIT 1`)
      .then((r) => r.rows[0]);

    if (!cohortBefore) {
      await client.query(sqlFile('seed.sql'));
      steps.push('Created the cohort and its eight weekly deliverables');
    } else {
      steps.push('Cohort already exists, left untouched');
    }

    const cohort = await client
      .query(`SELECT id, name FROM cohorts WHERE is_active ORDER BY starts_on LIMIT 1`)
      .then((r) => r.rows[0]);

    if (!cohort) throw new Error('No active cohort after seeding.');

    // Operator accounts. These grant nothing that ADMIN_EMAILS did not already
    // grant — signing in still requires control of the mailbox.
    const admins = adminEmails();
    if (!admins.length) {
      throw new Error('ADMIN_EMAILS is not set, so there is nobody to make an operator.');
    }

    const created = [];
    for (const email of admins) {
      const row = await client
        .query(
          `INSERT INTO members (cohort_id, email, full_name, sub_status, is_admin)
           VALUES ($1, $2, $3, 'active', true)
           ON CONFLICT (email) DO UPDATE SET is_admin = true
           RETURNING email, (xmax = 0) AS created`,
          [cohort.id, email, email.split('@')[0]]
        )
        .then((r) => r.rows[0]);
      if (row.created) created.push(row.email);
    }
    steps.push(
      created.length
        ? `Created operator account${created.length > 1 ? 's' : ''}: ${created.join(', ')}`
        : 'Operator accounts already existed'
    );

    // One-time sign-in link for the first operator, so setup does not depend on
    // email being configured yet.
    const token = crypto.randomBytes(32).toString('base64url');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await client.query(
      `INSERT INTO login_tokens (email, token_hash, expires_at)
       VALUES ($1, $2, now() + INTERVAL '30 minutes')`,
      [admins[0], hash]
    );

    return { steps, token, operator: admins[0], cohortName: cohort.name };
  });

  if (!acquired) {
    return { steps: ['Another setup run is already in progress.'], token: null };
  }
  return result;
}

/** Used by the setup page to show connectivity without leaking the URL. */
export async function databaseReachable() {
  try {
    await getPool().query('SELECT 1');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
