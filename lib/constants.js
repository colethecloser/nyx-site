/**
 * Dependency-free values shared by server validation and client forms.
 * Kept separate from `schemas.js` so a client component can import the labels
 * without pulling zod — or any server-only env reads — into the browser bundle.
 */

export const EXPERIENCE_LEVELS = ['none', 'beginner', 'intermediate', 'advanced'];

export const EXPERIENCE_LABELS = {
  none: 'None — starting from zero',
  beginner: 'Beginner — I follow markets, no formal modeling',
  intermediate: 'Intermediate — I have built models or pitched a stock',
  advanced: 'Advanced — internship or competition experience',
};

export const APPLICATION_STATUS_LABELS = {
  under_review: 'Under review',
  accepted: 'Accepted',
  waitlisted: 'Waitlisted',
  rejected: 'Declined',
  enrolled: 'Enrolled',
  withdrawn: 'Withdrawn',
};

/** Minimum lengths mirrored from the zod schema, for live character counters. */
export const MIN_THESIS_CHARS = 200;
export const MIN_WHY_CHARS = 80;
