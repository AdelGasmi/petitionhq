import {
  transporter,
  resolveRecipient,
  recordEmail,
  emailWrapper,
  esc,
  logger,
  BASE_URL,
} from "./transport";

// ---------------------------------------------------------------------------
// B-4: Nurture drip emails for Tier 3 leads
// ---------------------------------------------------------------------------

type NurtureContext = {
  to: string;
  name?: string | null;
  score?: number | null;
  field?: string | null;
  leadId: string;
};

function nurtureDay1({ to, name, score, field, leadId }: NurtureContext) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const greetingHtml = name ? `Hi ${esc(name)},` : "Hi,";
  const checkUrl = `${BASE_URL}/check`;
  const subject = `Your NIW profile: what to focus on first — petitionhq.us`;

  const text = `${greeting}

Thanks for checking your EB-2 NIW eligibility${field ? ` in ${field}` : ""}. Based on your profile, there are a few areas to strengthen before filing.

Here's what Tier 3 applicants typically need to focus on:

1. Build your publication record — aim for 5+ peer-reviewed papers with citations
2. Secure peer review or editorial roles — these demonstrate field recognition
3. Connect your work to a US national priority — this is critical for Prong 1

These aren't insurmountable. Many successful NIW petitioners started exactly where you are.

Re-check your eligibility anytime: ${checkUrl}

— The petitionhq.us team`;

  const html = `<div style="font-family:system-ui;max-width:520px;margin:0 auto;color:#1a1a1a">
<p>${greetingHtml}</p>
<p>Thanks for checking your EB-2 NIW eligibility${field ? ` in <strong>${esc(field)}</strong>` : ""}. Based on your profile, there are a few areas to strengthen before filing.</p>
<p style="font-weight:600;margin-top:20px">What to focus on first:</p>
<ol style="font-size:14px;line-height:1.7">
<li>Build your publication record — aim for 5+ peer-reviewed papers with citations</li>
<li>Secure peer review or editorial roles — these demonstrate field recognition</li>
<li>Connect your work to a US national priority — critical for Prong 1</li>
</ol>
<p style="color:#78716c;font-size:14px">These aren't insurmountable. Many successful NIW petitioners started exactly where you are.</p>
<div style="margin:24px 0"><a href="${checkUrl}" style="background:#1c1917;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:14px">Re-check your eligibility →</a></div>
</div>`;

  return { subject, text, html };
}

function nurtureDay7({ to, name, field, leadId }: NurtureContext) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const greetingHtml = name ? `Hi ${esc(name)},` : "Hi,";
  const checkUrl = `${BASE_URL}/check`;
  const subject = `3 quick wins to strengthen your NIW case`;

  const text = `${greeting}

A week ago you assessed your NIW eligibility${field ? ` in ${field}` : ""}. Here are three targeted moves that can meaningfully improve your standing:

1. Request to peer-review papers — journal editors actively welcome new reviewers, and it establishes you as a recognized expert in your field
2. Write a 1-page memo connecting your work to a US national priority (AI safety, clean energy, public health, etc.) — this is the heart of Prong 1
3. Pull your Google Scholar citation list and note your h-index — even 20–30 citations across 5+ papers makes a real difference

Many applicants move from "developing" to a strong case within 3–6 months with focused effort on just one or two of these.

Updated credentials? Re-assess: ${checkUrl}

— petitionhq.us`;

  const html = emailWrapper(`
    <p>${greetingHtml}</p>
    <p>It's been a week since you assessed your NIW eligibility${field ? ` in <strong>${esc(field)}</strong>` : ""}.</p>
    <p>Here are three moves that meaningfully improve your standing:</p>
    <ol style="font-size:14px;line-height:2;color:#44403c;padding-left:20px">
      <li>
        <strong>Request to peer-review papers.</strong> Journal editors actively welcome new reviewers —
        and it establishes you as a recognized expert in your field.
      </li>
      <li>
        <strong>Write a 1-page memo</strong> connecting your work to a US national priority
        (AI safety, clean energy, public health, etc.). This is the heart of Prong 1.
      </li>
      <li>
        <strong>Pull your Google Scholar citation list.</strong> Note your h-index.
        Even 20–30 citations across 5+ papers makes a real difference.
      </li>
    </ol>
    <p style="color:#57534e;font-size:14px">
      Many applicants move from an early-stage profile to a strong case within 3–6 months
      with focused effort on just one or two of these.
    </p>
    <div style="margin:24px 0">
      <a href="${checkUrl}" style="background:#1c1917;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-family:system-ui;font-size:14px;font-weight:600;display:inline-block">
        Re-assess my eligibility →
      </a>
    </div>
  `);

  return { subject, text, html };
}

function nurtureDay30({ to, name, field, leadId }: NurtureContext) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const greetingHtml = name ? `Hi ${esc(name)},` : "Hi,";
  const checkUrl = `${BASE_URL}/check`;
  const subject = `One month later — ready to re-assess your NIW case?`;

  const text = `${greeting}

It's been a month since you assessed your EB-2 NIW eligibility${field ? ` in ${field}` : ""}.

If you've done any of the following, your standing may have improved significantly:
- Added publications or preprints
- Accumulated more citations
- Taken on a peer-review role
- Received a grant, award, or invited talk
- Clarified how your work connects to a US priority

Re-assess now — it takes 3 minutes: ${checkUrl}

Applicants who re-test after strengthening their profile are significantly more likely to match with an attorney.

This is our last check-in. We won't reach out again unless you re-engage.

— petitionhq.us`;

  const html = emailWrapper(`
    <p>${greetingHtml}</p>
    <p>It's been a month since you assessed your EB-2 NIW eligibility${field ? ` in <strong>${esc(field)}</strong>` : ""}.</p>
    <p>If you've done any of the following since then, your standing may have improved:</p>
    <ul style="font-size:14px;line-height:2;color:#44403c;padding-left:20px">
      <li>Added publications or preprints</li>
      <li>Accumulated more citations</li>
      <li>Taken on a peer-review role</li>
      <li>Received a grant, award, or invited talk</li>
      <li>Clarified how your work connects to a US national priority</li>
    </ul>
    <div style="margin:24px 0">
      <a href="${checkUrl}" style="background:#1c1917;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-family:system-ui;font-size:14px;font-weight:600;display:inline-block">
        Re-assess my eligibility →
      </a>
    </div>
    <p style="color:#57534e;font-size:13px">Takes 3 minutes. Applicants who re-test after strengthening their profile are significantly more likely to match with an attorney.</p>
    <p style="color:#a8a29e;font-size:12px">This is our last check-in — we won't email again unless you re-engage.</p>
  `);

  return { subject, text, html };
}

export async function sendNurtureEmail(step: 1 | 2 | 3, ctx: NurtureContext): Promise<void> {
  const builders = { 1: nurtureDay1, 2: nurtureDay7, 3: nurtureDay30 };
  const { subject, text, html } = builders[step](ctx);

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>",
      to: resolveRecipient(ctx.to),
      subject,
      text,
      html,
    });
    recordEmail({ to: ctx.to, subject, kind: `nurture-day-${step}`, status: "sent" });
  } catch (e) {
    recordEmail({ to: ctx.to, subject, kind: `nurture-day-${step}`, status: "failed", error: String(e) });
    logger.error(`[nurture-day-${step}] email failed:`, e);
  }
}

// ─── Case filed notification ────────────────────────────────────────────────

export async function sendCaseFiledEmail({
  to,
  applicantName,
  attorneyName,
  caseTitle,
}: {
  to: string;
  applicantName?: string | null;
  attorneyName: string;
  caseTitle: string;
}) {
  const greeting = applicantName ? `Hi ${applicantName},` : "Hi,";
  const subject = `Your EB-2 NIW petition has been filed`;

  const text = `${greeting}

Great news — ${attorneyName} has officially filed your EB-2 NIW petition (${caseTitle}).

This is a significant milestone. Your petition is now in USCIS's hands.

What happens next:
1. USCIS will send a receipt notice (Form I-797), typically within 4–8 weeks.
2. Processing times vary — your attorney will keep you updated on any developments.
3. If USCIS has questions, they'll issue a Request for Evidence (RFE). Your attorney will handle it.

Congratulations on reaching this stage.

— petitionhq.us`;

  const html = emailWrapper(`
    <p>${applicantName ? `Hi ${esc(applicantName)},` : "Hi,"}</p>
    <p>Great news — <strong>${esc(attorneyName)}</strong> has officially filed your EB-2 NIW petition.</p>

    <div style="background:#f0fdf4;border-radius:10px;padding:20px 24px;margin:24px 0;border-left:3px solid #16a34a">
      <p style="margin:0 0 4px;font-size:13px;color:#15803d;text-transform:uppercase;letter-spacing:1px">Filed</p>
      <p style="margin:0;font-size:16px;font-weight:700;color:#14532d">${esc(caseTitle)}</p>
    </div>

    <p>Your petition is now in USCIS's hands. Here's what to expect:</p>
    <ol style="padding-left:20px;color:#44403c;font-size:14px;line-height:2">
      <li>USCIS will send a <strong>receipt notice</strong> (Form I-797), typically within 4–8 weeks.</li>
      <li>Processing times vary — your attorney will keep you updated on any developments.</li>
      <li>If USCIS has questions, they'll issue a <strong>Request for Evidence (RFE)</strong>. Your attorney will handle it.</li>
    </ol>

    <p style="font-size:15px;font-weight:600;margin-top:24px">Congratulations on reaching this stage.</p>

    <p style="font-size:13px;color:#78716c;margin-top:24px">
      Questions? Reply to this email or contact ${attorneyName} directly.
    </p>
  `);

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html,
    });
    recordEmail({ to, subject, kind: "case-filed", status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "case-filed", status: "failed", error: String(e) });
    logger.error("[case-filed] email failed:", e);
  }
}
