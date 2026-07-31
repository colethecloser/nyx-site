import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Test doubles for the two external services.
 *
 * Both are installed on `globalThis` before any lib module is imported, so the
 * lazily-cached singletons in lib/stripe.js and lib/email.js pick them up
 * instead of constructing real clients. Nothing in these tests touches the
 * network.
 */

export const sentEmails = [];

/** Replaces `fetch` for api.resend.com only; anything else throws loudly. */
export function stubResend() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const href = typeof url === 'string' ? url : url.url;
    if (href.includes('api.resend.com')) {
      const body = JSON.parse(init.body);
      sentEmails.push(body);
      return new Response(JSON.stringify({ id: `re_${sentEmails.length}` }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected network call in tests: ${href}`);
  };
  return () => {
    globalThis.fetch = realFetch;
  };
}

/** Minimal Stripe stand-in covering only what the webhook handlers call. */
export function stubStripe({ subscriptions = new Map() } = {}) {
  globalThis.__stripe = {
    subscriptions: {
      retrieve: async (id) => {
        const sub = subscriptions.get(id);
        if (!sub) throw new Error(`No stubbed subscription ${id}`);
        return sub;
      },
    },
  };
  return globalThis.__stripe;
}

export function makeSubscription(overrides = {}) {
  return {
    id: 'sub_test_1',
    status: 'active',
    cancel_at_period_end: false,
    customer: 'cus_test_1',
    current_period_end: Math.floor(Date.now() / 1000) + 365 * 86_400,
    items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 365 * 86_400 }] },
    metadata: {},
    ...overrides,
  };
}

export function readSql(name) {
  return fs.readFileSync(path.join(root, 'db', name), 'utf8');
}

/** Wipe every table between suites without dropping the schema. */
export async function resetDb(query) {
  await query(`TRUNCATE
    leaderboard_snapshots, submissions, sessions, login_tokens, email_log,
    stripe_events, job_runs, rate_limits, members, applications, deliverables, cohorts
    RESTART IDENTITY CASCADE`);
  sentEmails.length = 0;
}

export function validApplication(overrides = {}) {
  return {
    email: 'applicant@eagle.fgcu.edu',
    full_name: 'Jordan Reyes',
    grad_year: 2027,
    major: 'Finance',
    gpa: 3.6,
    experience_level: 'intermediate',
    hours_per_week: 8,
    has_brokerage: true,
    target_role: 'Equity research',
    linkedin_url: 'https://linkedin.com/in/jordanreyes',
    why_join:
      'I have been building models on my own for a year and I have nobody to tell me when they are wrong. I want the feedback loop more than the credential, and I want to be around people who will call out a lazy assumption.',
    recent_thesis:
      'Long CHTR. Consensus treats broadband subscriber losses as structural, but the losses are concentrated in the low-ARPU rural footprint that fixed wireless can actually serve, while the suburban base is stable. The market is mispricing this: at 6.2x EV/EBITDA the stock discounts a permanent decline, yet capex rolls off in 2026 and FCF per share inflects sharply as the rural construction program completes. The variant perception is that FWA saturates at spectrum capacity limits rather than continuing to take share. I would be wrong if fixed wireless capacity expands faster than expected, or if capex does not actually roll off and management extends the build program another two years.',
    commitment_note: 'Heavy spring semester but I have blocked Sunday mornings.',
    referral_source: 'Professor',
  };
}
