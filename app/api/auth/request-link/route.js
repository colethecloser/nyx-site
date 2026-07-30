import crypto from 'node:crypto';
import { queryOne } from '../../../../lib/db.js';
import { badRequest, fieldErrors, handleError, json, readJson } from '../../../../lib/api.js';
import { clientIp, createLoginToken } from '../../../../lib/auth.js';
import { rateLimit } from '../../../../lib/ratelimit.js';
import { loginSchema } from '../../../../lib/schemas.js';
import { sendOnce } from '../../../../lib/email.js';
import { magicLink } from '../../../../lib/emails/templates.js';
import { siteUrl } from '../../../../lib/env.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await readJson(request);
    if (!body) return badRequest('Malformed request body');

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: 'Enter a valid email.', fields: fieldErrors(parsed.error) }, { status: 422 });
    }
    const { email } = parsed.data;

    const limit = await rateLimit({ key: `login:${email}`, limit: 5, windowSeconds: 900 });
    const ipLimit = await rateLimit({
      key: `login:ip:${clientIp(request)}`,
      limit: 15,
      windowSeconds: 900,
    });

    // The response is identical whether or not the address belongs to a member,
    // and whether or not it was rate limited. Anything else turns this endpoint
    // into a membership oracle.
    const generic = json({ ok: true });

    if (!limit.ok || !ipLimit.ok) return generic;

    const member = await queryOne(`SELECT id, email FROM members WHERE email = $1`, [email]);
    if (!member) return generic;

    const token = await createLoginToken(member.email);
    const tpl = magicLink({
      loginUrl: `${siteUrl()}/api/auth/verify?token=${encodeURIComponent(token)}`,
    });

    await sendOnce({
      to: member.email,
      template: 'magic_link',
      // Every request is a distinct message, so the dedupe key must be unique;
      // replay protection here is the rate limiter's job, not the mail log's.
      dedupeKey: `login:${crypto.randomUUID()}`,
      ...tpl,
    }).catch((err) => console.error('[auth] magic link send failed:', err.message));

    return generic;
  } catch (err) {
    return handleError(err, 'auth.requestLink');
  }
}
