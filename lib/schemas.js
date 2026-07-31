import { z } from 'zod';
import { optionalEnv } from './env.js';
import { EXPERIENCE_LEVELS, MIN_THESIS_CHARS, MIN_WHY_CHARS } from './constants.js';

const FGCU_DOMAINS = optionalEnv('ALLOWED_EMAIL_DOMAINS', 'eagle.fgcu.edu,fgcu.edu')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const enforceDomain = optionalEnv('REQUIRE_FGCU_EMAIL', 'true') !== 'false';

/** Empty strings from HTML forms should read as "not provided", not as "". */
const blankToUndefined = (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optionalText = (max) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

export const emailField = z
  .email('Enter a valid email address')
  .max(200)
  .transform((v) => v.trim().toLowerCase())
  .refine(
    (v) => !enforceDomain || FGCU_DOMAINS.some((d) => v.endsWith(`@${d}`)),
    { message: `Use your FGCU email (${FGCU_DOMAINS.map((d) => `@${d}`).join(' or ')})` }
  );

export const applicationSchema = z.object({
  full_name: z.string().trim().min(2, 'Tell us your full name').max(120),
  email: emailField,
  phone: optionalText(30),
  grad_year: z.coerce
    .number()
    .int()
    .min(2024, 'Enter a four-digit graduation year')
    .max(2035, 'Enter a four-digit graduation year'),
  major: z.string().trim().min(2, 'What are you majoring in?').max(80),
  gpa: z.preprocess(
    blankToUndefined,
    z.coerce.number().min(0).max(4.5, 'GPA must be on a 4.0 scale').optional()
  ),
  experience_level: z.enum(EXPERIENCE_LEVELS, 'Pick the option closest to your experience'),
  hours_per_week: z.coerce
    .number()
    .int()
    .min(0)
    .max(40, 'Be realistic — nobody is doing 40 hours on top of classes'),
  // `z.coerce.boolean()` would read the string "false" as true, so normalize the
  // checkbox/JSON shapes explicitly.
  has_brokerage: z.preprocess((v) => {
    if (typeof v === 'string') return ['true', 'on', '1', 'yes'].includes(v.toLowerCase());
    return v ?? false;
  }, z.boolean()),
  target_role: optionalText(120),
  linkedin_url: z.preprocess(
    blankToUndefined,
    z.url('Enter a full URL, including https://').max(300).optional()
  ),
  why_join: z
    .string()
    .trim()
    .min(MIN_WHY_CHARS, 'Give us at least a few sentences — this is read by a human')
    .max(2000),
  recent_thesis: z
    .string()
    .trim()
    .min(MIN_THESIS_CHARS, 'This is the question that decides your application. Write it properly.')
    .max(5000),
  commitment_note: optionalText(1000),
  referral_source: optionalText(120),
  agree_terms: z.literal(true, 'You must agree to the cohort commitment'),
});

export const submissionSchema = z.object({
  deliverable_id: z.uuid('Unknown deliverable'),
  url: z.preprocess(
    blankToUndefined,
    z.url('Enter a full URL, including https://').max(500).optional()
  ),
  notes: z
    .string()
    .trim()
    .min(20, 'Add a short note on what you did and where you struggled')
    .max(3000),
});

export const loginSchema = z.object({
  // Sign-in must not enforce the FGCU domain: an alum or an admin on another
  // address still needs to reach their dashboard.
  email: z.email('Enter a valid email address').max(200).transform((v) => v.trim().toLowerCase()),
});

export const decisionSchema = z.object({
  status: z.enum(['accepted', 'waitlisted', 'rejected']),
  reason: optionalText(500),
});

export const gradeSchema = z.object({
  points_awarded: z.coerce.number().int().min(0).max(1000),
  feedback: optionalText(2000),
});

export { FGCU_DOMAINS, EXPERIENCE_LEVELS };
