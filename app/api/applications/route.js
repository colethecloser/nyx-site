import { queryOne } from '../../../lib/db.js';
import { badRequest, fieldErrors, handleError, json, readJson } from '../../../lib/api.js';
import { clientIp } from '../../../lib/auth.js';
import { rateLimit } from '../../../lib/ratelimit.js';
import { applicationSchema } from '../../../lib/schemas.js';
import {
  autoDecisionFor,
  decide,
  getActiveCohort,
  scoreApplication,
  seatCounts,
  sendDecisionEmail,
} from '../../../lib/applications.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const ipLimit = await rateLimit({
      key: `apply:ip:${clientIp(request)}`,
      limit: 5,
      windowSeconds: 3600,
    });
    if (!ipLimit.ok) {
      return json({ error: 'Too many applications from this connection. Try again later.' }, { status: 429 });
    }

    const body = await readJson(request);
    if (!body) return badRequest('Malformed request body');

    const parsed = applicationSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Please fix the highlighted fields.', fields: fieldErrors(parsed.error) }, { status: 422 });
    }
    const input = parsed.data;

    const emailLimit = await rateLimit({
      key: `apply:email:${input.email}`,
      limit: 3,
      windowSeconds: 86_400,
    });
    if (!emailLimit.ok) {
      return json({ error: 'You have already applied recently.' }, { status: 429 });
    }

    const cohort = await getActiveCohort();
    if (!cohort) return json({ error: 'No cohort is currently open.' }, { status: 503 });
    if (!cohort.applications_open) {
      return json({ error: 'Applications for this cohort are closed.' }, { status: 403 });
    }

    const { score, breakdown } = scoreApplication(input);

    let row;
    try {
      row = await queryOne(
        `INSERT INTO applications (
           cohort_id, email, full_name, phone, grad_year, major, gpa,
           experience_level, hours_per_week, has_brokerage, target_role, linkedin_url,
           why_join, recent_thesis, commitment_note, referral_source,
           score, score_breakdown
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         RETURNING *`,
        [
          cohort.id,
          input.email,
          input.full_name,
          input.phone ?? null,
          input.grad_year,
          input.major,
          input.gpa ?? null,
          input.experience_level,
          input.hours_per_week,
          input.has_brokerage,
          input.target_role ?? null,
          input.linkedin_url ?? null,
          input.why_join,
          input.recent_thesis,
          input.commitment_note ?? null,
          input.referral_source ?? null,
          score,
          JSON.stringify(breakdown),
        ]
      );
    } catch (err) {
      // Partial unique index on (cohort_id, email) for live statuses.
      if (err.code === '23505') {
        return json(
          { error: 'You already have an application in flight for this cohort. Check your email.' },
          { status: 409 }
        );
      }
      throw err;
    }

    // Auto-vetting. Anything the rubric cannot call confidently stays in
    // `under_review` for a human, and the daily cron sweeps it if we sit on it.
    const { seatsLeft } = await seatCounts(cohort.id);
    const target = autoDecisionFor(score, seatsLeft);

    let application = row;
    let inviteToken = null;
    if (target !== 'under_review') {
      const result = await decide({
        applicationId: row.id,
        status: target,
        decidedBy: 'auto',
        reason: `auto: score ${score}/100`,
      });
      application = result.application;
      inviteToken = result.inviteToken;
    }

    // Email failures must not fail the submission — the applicant's data is
    // safely stored, and the retry sweep will pick the message back up.
    await sendDecisionEmail({ application, inviteToken, cohort, seatsLeft }).catch((err) =>
      console.error('[applications] decision email failed:', err.message)
    );

    return json({ id: application.id, status: application.status }, { status: 201 });
  } catch (err) {
    return handleError(err, 'applications.POST');
  }
}
