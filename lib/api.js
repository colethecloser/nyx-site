import { NextResponse } from 'next/server';
import { AuthError } from './auth.js';
import { MissingEnvError } from './env.js';

export function json(body, init) {
  return NextResponse.json(body, init);
}

export function badRequest(message, details) {
  return NextResponse.json({ error: message, details }, { status: 400 });
}

/**
 * Single place that turns a thrown error into a response.
 *
 * Two rules: never leak an internal message to the client, and always log the
 * real one. `MissingEnvError` becomes a 503 because an unconfigured deployment
 * is unavailable, not broken.
 */
export function handleError(err, context) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof MissingEnvError) {
    console.error(`[${context}] not configured:`, err.message);
    return NextResponse.json(
      { error: 'This feature is not configured yet. Please try again later.' },
      { status: 503 }
    );
  }
  console.error(`[${context}]`, err);
  return NextResponse.json({ error: 'Something went wrong on our end.' }, { status: 500 });
}

/** Flatten zod issues into `{ field: message }` for inline form errors. */
export function fieldErrors(zodError) {
  const out = {};
  for (const issue of zodError.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Parse a JSON body defensively — a malformed body is a 400, not a 500. */
export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
