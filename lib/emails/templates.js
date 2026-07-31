import { siteUrl } from '../env.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BRAND = 'FGCU Student Investment Group';

/** Shared shell. `blocks` is an array of already-escaped HTML fragments. */
function layout({ preheader, heading, blocks, cta }) {
  const ctaHtml = cta
    ? `<tr><td style="padding:8px 0 24px">
         <a href="${escapeHtml(cta.href)}"
            style="display:inline-block;background:#f6c878;color:#241704;font-weight:600;
                   font-size:15px;padding:14px 28px;border-radius:10px;text-decoration:none">
           ${escapeHtml(cta.label)}
         </a>
       </td></tr>`
    : '';

  return `<!doctype html><html><body style="margin:0;background:#06070f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <span style="display:none;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06070f;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#0b1130;border:1px solid rgba(255,255,255,.09);
                    border-radius:16px;padding:36px 34px">
        <tr><td style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#6fe0ec;padding-bottom:18px">
          ${escapeHtml(BRAND)}
        </td></tr>
        <tr><td style="font-size:26px;line-height:1.15;color:#eef1fb;font-weight:600;padding-bottom:18px">
          ${escapeHtml(heading)}
        </td></tr>
        ${blocks.map((b) => `<tr><td style="font-size:15px;line-height:1.6;color:#9aa0c4;padding-bottom:16px">${b}</td></tr>`).join('')}
        ${ctaHtml}
        <tr><td style="border-top:1px solid rgba(255,255,255,.09);padding-top:18px;font-size:12px;color:#5b628a">
          You are receiving this because you applied to or joined the ${escapeHtml(BRAND)} at Florida Gulf Coast University.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function textify(lines, cta) {
  const body = lines.join('\n\n');
  return cta ? `${body}\n\n${cta.label}: ${cta.href}\n` : `${body}\n`;
}

const p = (s) => `<p style="margin:0">${escapeHtml(s)}</p>`;

// ---------------------------------------------------------------------------
// Application funnel
// ---------------------------------------------------------------------------

export function applicationReceived({ name, cohortName }) {
  const lines = [
    `${name} — your application to ${cohortName} is in.`,
    'Every application is read. We look at the thesis question first, so if you rushed it, that is the part to worry about.',
    'You will hear back within three days either way. No news is not a decision — we will always tell you.',
  ];
  return {
    subject: `Application received — ${cohortName}`,
    html: layout({
      preheader: 'We have your application. Decision within three days.',
      heading: 'Application received',
      blocks: lines.map(p),
    }),
    text: textify(lines),
  };
}

export function applicationAccepted({ name, cohortName, inviteUrl, priceLabel, seatsLeft, expiresLabel }) {
  const lines = [
    `${name} — you're in.`,
    `Your thesis was strong enough to earn a seat in ${cohortName}. ${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} remain in this cohort.`,
    `Membership is ${priceLabel} per year. It covers the full eight-week program, weekly deliverable review, the peer leaderboard, and access to every future cohort session while your membership is active.`,
    `Claim your seat by ${expiresLabel}. After that the seat goes to the waitlist.`,
  ];
  return {
    subject: `You're in — claim your seat in ${cohortName}`,
    html: layout({
      preheader: 'Accepted. Claim your seat before the invite expires.',
      heading: "You're in",
      blocks: lines.map(p),
      cta: { label: 'Claim your seat', href: inviteUrl },
    }),
    text: textify(lines, { label: 'Claim your seat', href: inviteUrl }),
  };
}

export function applicationWaitlisted({ name, cohortName, rank }) {
  const lines = [
    `${name} — you're on the waitlist for ${cohortName}.`,
    `You are number ${rank} in line. This is not a soft no: seats open when accepted applicants let their invite lapse, and the waitlist is worked in order, automatically.`,
    'If a seat opens you will get an invite by email with a claim window. Nothing is required from you until then.',
  ];
  return {
    subject: `Waitlisted — ${cohortName}`,
    html: layout({
      preheader: `You are number ${rank} on the waitlist.`,
      heading: `Waitlisted — number ${rank}`,
      blocks: lines.map(p),
    }),
    text: textify(lines),
  };
}

export function applicationRejected({ name, cohortName }) {
  const lines = [
    `${name} — we are not able to offer you a seat in ${cohortName}.`,
    'Cohorts are capped so that every deliverable gets read properly, which means turning down people who would have done fine. That is the honest version.',
    'The most common gap is the thesis question: a position with a stated variant perception and named disconfirming evidence scores far above a summary of what a company does. Applications reopen for the next cohort, and reapplying is encouraged.',
  ];
  return {
    subject: `Your application to ${cohortName}`,
    html: layout({
      preheader: 'A decision on your application.',
      heading: 'Not this cohort',
      blocks: lines.map(p),
    }),
    text: textify(lines),
  };
}

// ---------------------------------------------------------------------------
// Membership / billing
// ---------------------------------------------------------------------------

export function memberWelcome({ name, cohortName, startsOn, loginUrl }) {
  const lines = [
    `${name} — payment confirmed, seat locked.`,
    `${cohortName} begins ${startsOn}. Week 1 unlocks on your dashboard that morning; each deliverable is published Monday and due the following Sunday night.`,
    'Points come from submitted work, and the leaderboard is recalculated every Monday. Consecutive weeks build a streak, and streaks are the only multiplier.',
    'The link below signs you in. It is single-use and expires in 30 minutes — request a new one any time from the sign-in page.',
  ];
  return {
    subject: `Welcome to ${cohortName}`,
    html: layout({
      preheader: 'Your seat is confirmed. Here is your dashboard.',
      heading: 'Seat confirmed',
      blocks: lines.map(p),
      cta: { label: 'Open your dashboard', href: loginUrl },
    }),
    text: textify(lines, { label: 'Open your dashboard', href: loginUrl }),
  };
}

export function magicLink({ loginUrl }) {
  const lines = [
    'Here is your sign-in link. It works once and expires in 30 minutes.',
    'If you did not request this, you can ignore it — nothing happens until the link is opened.',
  ];
  return {
    subject: 'Your sign-in link',
    html: layout({
      preheader: 'Single-use sign-in link, expires in 30 minutes.',
      heading: 'Sign in',
      blocks: lines.map(p),
      cta: { label: 'Sign in', href: loginUrl },
    }),
    text: textify(lines, { label: 'Sign in', href: loginUrl }),
  };
}

export function paymentFailed({ name, attemptLabel, billingUrl }) {
  const lines = [
    `${name} — your annual membership payment did not go through.`,
    `${attemptLabel} Your dashboard stays open while the retries run, so there is nothing to lose if you update the card now.`,
    'If the final retry fails, access pauses and your leaderboard standing is frozen rather than deleted.',
  ];
  return {
    subject: 'Payment issue on your membership',
    html: layout({
      preheader: 'Your membership payment failed. Update your card.',
      heading: 'Payment did not go through',
      blocks: lines.map(p),
      cta: { label: 'Update payment method', href: billingUrl },
    }),
    text: textify(lines, { label: 'Update payment method', href: billingUrl }),
  };
}

export function subscriptionEnded({ name, cohortName }) {
  const lines = [
    `${name} — your ${cohortName} membership has ended.`,
    'Your submissions and standing are preserved. If you rejoin, they come back with you.',
    'If this was not intentional, reply to this email and we will sort it out.',
  ];
  return {
    subject: 'Your membership has ended',
    html: layout({
      preheader: 'Membership ended. Your record is preserved.',
      heading: 'Membership ended',
      blocks: lines.map(p),
    }),
    text: textify(lines),
  };
}

export function renewalConfirmed({ name, amountLabel, periodEndLabel }) {
  const lines = [
    `${name} — your membership renewed for ${amountLabel}.`,
    `You are paid through ${periodEndLabel}.`,
  ];
  return {
    subject: 'Membership renewed',
    html: layout({
      preheader: 'Your annual membership renewed.',
      heading: 'Renewed',
      blocks: lines.map(p),
    }),
    text: textify(lines),
  };
}

// ---------------------------------------------------------------------------
// Weekly operating rhythm
// ---------------------------------------------------------------------------

export function deliverablePublished({ name, weekNumber, title, description, dueLabel, points, dashboardUrl }) {
  const lines = [
    `${name} — Week ${weekNumber} is live.`,
    title,
    description,
    `Due ${dueLabel}. Worth ${points} points. Late submissions still count for half.`,
  ];
  return {
    subject: `Week ${weekNumber}: ${title}`,
    html: layout({
      preheader: `Week ${weekNumber} is live. Due ${dueLabel}.`,
      heading: `Week ${weekNumber} — ${title}`,
      blocks: [p(description), p(`Due ${dueLabel}. Worth ${points} points. Late submissions still count for half.`)],
      cta: { label: 'Open the deliverable', href: dashboardUrl },
    }),
    text: textify(lines, { label: 'Open the deliverable', href: dashboardUrl }),
  };
}

export function deliverableDueSoon({ name, weekNumber, title, dueLabel, streakWeeks, dashboardUrl }) {
  const streakLine = streakWeeks > 0
    ? `You are on a ${streakWeeks}-week streak. Missing this resets it to zero.`
    : 'Submitting this week starts a streak.';
  const lines = [
    `${name} — Week ${weekNumber} (${title}) is due ${dueLabel} and we do not have your submission.`,
    streakLine,
    'A partial submission scores. A missing one does not.',
  ];
  return {
    subject: `Due ${dueLabel}: Week ${weekNumber}`,
    html: layout({
      preheader: `Week ${weekNumber} is due ${dueLabel}.`,
      heading: `Week ${weekNumber} is due ${dueLabel}`,
      blocks: lines.map(p),
      cta: { label: 'Submit now', href: dashboardUrl },
    }),
    text: textify(lines, { label: 'Submit now', href: dashboardUrl }),
  };
}

export function weeklyDigest({ name, weekOfLabel, rank, totalMembers, points, pointsDelta, streakWeeks, leaderName, leaderPoints, leaderboardUrl }) {
  const deltaLabel = pointsDelta > 0 ? `+${pointsDelta} points this week` : 'no points added this week';
  const lines = [
    `${name} — leaderboard for the week of ${weekOfLabel}.`,
    `You are ranked ${rank} of ${totalMembers} with ${points} points (${deltaLabel}).`,
    streakWeeks > 0 ? `Current streak: ${streakWeeks} week${streakWeeks === 1 ? '' : 's'}.` : 'No active streak.',
    `Cohort leader: ${leaderName} with ${leaderPoints} points.`,
  ];
  return {
    subject: `You're #${rank} — week of ${weekOfLabel}`,
    html: layout({
      preheader: `Ranked ${rank} of ${totalMembers} with ${points} points.`,
      heading: `#${rank} of ${totalMembers}`,
      blocks: lines.slice(1).map(p),
      cta: { label: 'See the full leaderboard', href: leaderboardUrl },
    }),
    text: textify(lines, { label: 'See the full leaderboard', href: leaderboardUrl }),
  };
}

export function adminDigest({ weekOfLabel, pendingReviews, ungraded, atRisk, adminUrl }) {
  const lines = [
    `Operator digest — week of ${weekOfLabel}.`,
    `${pendingReviews} application(s) awaiting a decision.`,
    `${ungraded} submission(s) ungraded.`,
    `${atRisk} member(s) have missed two or more deliverables.`,
  ];
  return {
    subject: `Cohort digest — week of ${weekOfLabel}`,
    html: layout({
      preheader: `${pendingReviews} applications, ${ungraded} ungraded, ${atRisk} at risk.`,
      heading: 'Operator digest',
      blocks: lines.slice(1).map(p),
      cta: { label: 'Open admin', href: adminUrl },
    }),
    text: textify(lines, { label: 'Open admin', href: adminUrl }),
  };
}

export function dashboardUrl() {
  return `${siteUrl()}/dashboard`;
}

export function leaderboardUrl() {
  return `${siteUrl()}/leaderboard`;
}
