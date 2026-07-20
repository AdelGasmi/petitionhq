import type { SessionPayload } from "../auth";
import { transporter, resolveRecipient, recordEmail, esc } from "./transport";

export async function sendLetterEmail({
  to,
  subject,
  recipientName,
  applicantName,
  letterType,
  pdfBuffer,
  filename,
  firmName,
  attorneyName,
  caseId,
  caseTitle,
  actor,
}: {
  to: string;
  subject: string;
  recipientName?: string;
  applicantName?: string;
  letterType?: string;
  pdfBuffer: Buffer;
  filename: string;
  firmName?: string;
  attorneyName?: string;
  caseId?: string;
  caseTitle?: string;
  actor?: SessionPayload | null;
}): Promise<void> {
  const greeting = recipientName ? `Dear ${esc(recipientName)},` : "Dear recipient,";
  const letterDesc = letterType
    ? `${esc(letterType)} for ${esc(applicantName ?? "the applicant")}`
    : `the attached letter for ${esc(applicantName ?? "the applicant")}`;
  const signoff = attorneyName ? esc(attorneyName) : (firmName ? esc(firmName) : "PetitionHQ");

  const text = `${greeting.replace(/,/, "")}

Please find attached ${letterDesc.replace(/&amp;/g, "&")}.

The letter is provided as a signed PDF. If you have any questions, please reply directly to this email.

— ${signoff}`;

  const html = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a;line-height:1.7">
      <p>${greeting}</p>
      <p>Please find attached ${letterDesc}.</p>
      <p>The letter is provided as a signed PDF. If you have any questions, please reply directly to this email.</p>
      <p style="margin-top:24px;color:#57534e">— ${signoff}</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html,
      attachments: [{ filename, content: pdfBuffer, contentType: "application/pdf" }],
    });
    recordEmail({ to, subject, kind: "letter", caseId, caseTitle, actor, status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "letter", caseId, caseTitle, actor, status: "failed", error: String(e) });
    throw e;
  }
}

export async function sendReviewInviteEmail({
  to,
  recommenderName,
  applicantName,
  letterTitle,
  reviewUrl,
  expiryDays = 14,
  caseId,
  caseTitle,
  actor,
}: {
  to: string;
  recommenderName: string;
  applicantName: string;
  letterTitle: string;
  reviewUrl: string;
  expiryDays?: number;
  caseId?: string;
  caseTitle?: string;
  actor?: SessionPayload | null;
}): Promise<void> {
  const subject = `Action needed: Review recommendation letter for ${applicantName}`;

  const text = `Dear ${recommenderName},

You have been asked to review and finalize a letter of recommendation for ${applicantName}'s U.S. immigration petition (EB-2 National Interest Waiver).

A draft has been prepared for you. Please review it, make any edits you see fit, and submit it using the secure link below. No account or login is required.

Review link (valid for ${expiryDays} days):
${reviewUrl}

What to do:
1. Open the link above
2. Read the draft — it was prepared based on your credentials and your relationship with ${applicantName}
3. Edit any wording you'd like to change
4. Click "Submit letter" when you're satisfied

Your submitted version will be used directly in the immigration petition. This link expires in ${expiryDays} days.

Thank you for supporting ${applicantName}'s petition.`;

  const html = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a;line-height:1.7">
      <p>Dear ${esc(recommenderName)},</p>
      <p>You have been asked to review and finalize a <strong>letter of recommendation</strong> for
        <strong>${esc(applicantName)}</strong>'s U.S. immigration petition (EB-2 National Interest Waiver).</p>
      <p>A draft has been prepared for you. Please review it, make any edits you see fit, and submit it using the secure link below.
        <strong>No account or login is required.</strong></p>
      <div style="margin:28px 0;text-align:center">
        <a href="${reviewUrl}"
           style="background:#1c1917;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-family:system-ui;font-size:15px">
          Review &amp; submit letter
        </a>
      </div>
      <p style="font-size:14px;color:#555">This link is valid for ${expiryDays} days and is unique to you.</p>
      <p style="font-size:14px;color:#555">
        If the button doesn't work, copy this URL into your browser:<br/>
        <span style="color:#1c1917">${reviewUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0"/>
      <p style="font-size:13px;color:#78716c">
        You received this because ${esc(applicantName)} listed you as a recommender on their NIW petition.
        If this is unexpected, please disregard this email.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html,
    });
    recordEmail({ to, subject, kind: "review-invite", caseId, caseTitle, actor, status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "review-invite", caseId, caseTitle, actor, status: "failed", error: String(e) });
    throw e;
  }
}

export async function sendRecommenderNudgeEmail({
  to,
  recommenderName,
  applicantName,
  daysWaiting,
  isSecondNudge = false,
  caseId,
  caseTitle,
}: {
  to: string;
  recommenderName: string;
  applicantName: string;
  daysWaiting: number;
  isSecondNudge?: boolean;
  caseId?: string;
  caseTitle?: string;
}): Promise<void> {
  const subject = isSecondNudge
    ? `Reminder: recommendation letter for ${applicantName} still needs your review`
    : `Friendly reminder: ${applicantName}'s recommendation letter is waiting for your review`;

  const urgency = isSecondNudge
    ? "This is the final reminder — the review link will expire soon."
    : `It's been ${daysWaiting} days since the review link was sent.`;

  const text = `Dear ${recommenderName},

${urgency}

${applicantName} is relying on your recommendation letter for their EB-2 NIW immigration petition. The draft has been prepared for you — it takes about 5 minutes to review and submit.

Please check your inbox for the original review link email, or contact ${applicantName}'s attorney if you need the link resent.

Thank you for your support.`;

  const html = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a;line-height:1.7">
      <p>Dear ${esc(recommenderName)},</p>
      <p>${esc(urgency)}</p>
      <p><strong>${esc(applicantName)}</strong> is relying on your recommendation letter for their EB-2 NIW immigration petition.
        The draft has been prepared for you — <strong>it takes about 5 minutes</strong> to review and submit.</p>
      <p style="font-size:14px;color:#555">Please check your inbox for the original review link email, or contact ${esc(applicantName)}'s attorney if you need the link resent.</p>
      <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0"/>
      <p style="font-size:13px;color:#78716c">
        You received this because ${esc(applicantName)} listed you as a recommender on their NIW petition.
        If this is unexpected, please disregard this email.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html,
    });
    recordEmail({ to, subject, kind: "review-nudge", caseId, caseTitle, status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "review-nudge", caseId, caseTitle, status: "failed", error: String(e) });
    throw e;
  }
}

export async function sendNotificationEmail({
  to,
  subject,
  text,
  caseId,
  caseTitle,
  actor,
}: {
  to: string;
  subject: string;
  text: string;
  caseId?: string;
  caseTitle?: string;
  actor?: SessionPayload | null;
}): Promise<void> {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html: `<div style="font-family:system-ui;max-width:600px;margin:0 auto">${text.replace(/\n/g, "<br/>")}</div>`,
    });
    recordEmail({ to, subject, kind: "notification", caseId, caseTitle, actor, status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "notification", caseId, caseTitle, actor, status: "failed", error: String(e) });
    throw e;
  }
}

export async function sendVerificationEmail({
  to,
  name,
  code,
}: {
  to: string;
  name: string;
  code: string;
}): Promise<void> {
  if (!code) throw new Error("Verification code is required");
  const subject = `${code} — your petitionhq.us verification code`;
  const text = `Hi ${name},\n\nYour verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
      <p style="margin-bottom:8px">Hi ${esc(name)},</p>
      <p style="margin-bottom:24px">Enter the code below to verify your account:</p>
      <div style="background:#f5f5f4;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <span style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:12px;color:#1c1917">
          ${code}
        </span>
      </div>
      <p style="font-size:13px;color:#78716c">This code expires in 10 minutes. Do not share it with anyone.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html,
    });
    recordEmail({ to, subject, kind: "verification", status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "verification", status: "failed", error: String(e) });
    throw e;
  }
}

export async function sendPasswordResetEmail({
  to,
  name,
  code,
}: {
  to: string;
  name: string;
  code: string;
}): Promise<void> {
  if (!code) throw new Error("Reset code is required");
  const subject = `${code} — your petitionhq.us password reset code`;
  const text = `Hi ${name},\n\nWe received a request to reset your PetitionHQ password.\n\nYour reset code is: ${code}\n\nEnter it on the password reset page to choose a new password. This code expires in 15 minutes. Do not share it with anyone.\n\nIf you didn't request this, you can safely ignore this email — your password will not change.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
      <p style="margin-bottom:8px">Hi ${esc(name)},</p>
      <p style="margin-bottom:24px">We received a request to reset your PetitionHQ password. Enter the code below to choose a new one:</p>
      <div style="background:#f5f5f4;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <span style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:12px;color:#1c1917">
          ${code}
        </span>
      </div>
      <p style="font-size:13px;color:#78716c">This code expires in 15 minutes. Do not share it with anyone.</p>
      <p style="font-size:13px;color:#78716c">If you didn't request this, you can safely ignore this email — your password will not change.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html,
    });
    recordEmail({ to, subject, kind: "password-reset", status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "password-reset", status: "failed", error: String(e) });
    throw e;
  }
}

export async function sendIntakeVerificationEmail({
  to,
  code,
}: {
  to: string;
  code: string;
}): Promise<void> {
  const subject = `${code} — verify your identity to access the intake form`;
  const text = `Your verification code is: ${code}\n\nEnter this code on the intake page to access the form. This code expires in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
      <p style="margin-bottom:8px">Verify your identity</p>
      <p style="margin-bottom:24px;font-size:14px;color:#555">Enter the code below on the intake page to access the form:</p>
      <div style="background:#f5f5f4;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <span style="font-family:monospace;font-size:36px;font-weight:700;letter-spacing:12px;color:#1c1917">
          ${code}
        </span>
      </div>
      <p style="font-size:13px;color:#78716c">This code expires in 10 minutes. Do not share it with anyone.</p>
      <p style="font-size:13px;color:#78716c">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html,
    });
    recordEmail({ to, subject, kind: "intake-verification", status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "intake-verification", status: "failed", error: String(e) });
    throw e;
  }
}

export async function sendIntakeInviteEmail({
  to,
  intakeUrl,
  caseTitle,
  attorneyName,
  expiryDays = 2,
  caseId,
  actor,
}: {
  to: string;
  intakeUrl: string;
  caseTitle: string;
  attorneyName: string;
  expiryDays?: number;
  caseId?: string;
  actor?: SessionPayload | null;
}): Promise<void> {
  const subject = `Action needed: fill in your petition evidence — ${caseTitle}`;

  const text = `Hello,

${attorneyName} has started preparing your immigration petition and needs some information from you to draft the strongest possible case.

Please use the secure link below to enter your background, research output, and professional recognition. It takes about 10–15 minutes and requires no account or login.

Fill in your information (valid for ${expiryDays} days):
${intakeUrl}

What you'll be asked:
- Your degree and field of specialization
- Your proposed US work and why it matters nationally
- Your publications, citation counts, and research contributions
- Awards, grants, editorial roles, and invited talks

This information feeds directly into the AI-assisted drafting of your petition brief and recommendation letters.

If you have any questions, reply to this email or contact your attorney directly.`;

  const html = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a;line-height:1.7">
      <p>Hello,</p>
      <p><strong>${esc(attorneyName)}</strong> has started preparing your immigration petition and needs some information from you to draft the strongest possible case.</p>
      <p>Please use the secure link below to enter your background, research output, and professional recognition.
         <strong>It takes about 10–15 minutes and requires no account or login.</strong></p>
      <div style="margin:28px 0;text-align:center">
        <a href="${intakeUrl}"
           style="background:#1c1917;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-family:system-ui;font-size:15px">
          Fill in my information →
        </a>
      </div>
      <p style="font-size:14px;color:#555"><strong>What you'll be asked:</strong></p>
      <ul style="font-size:14px;color:#555;margin:0;padding-left:20px">
        <li>Your degree and field of specialization</li>
        <li>Your proposed US work and why it matters nationally</li>
        <li>Your publications, citation counts, and research contributions</li>
        <li>Awards, grants, editorial roles, and invited talks</li>
      </ul>
      <p style="font-size:14px;color:#555;margin-top:16px">This link is valid for ${expiryDays} days.</p>
      <p style="font-size:14px;color:#555">
        If the button doesn't work, copy this URL into your browser:<br/>
        <span style="color:#1c1917">${intakeUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0"/>
      <p style="font-size:13px;color:#78716c">
        If you weren't expecting this, please contact ${esc(attorneyName)} directly.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html,
    });
    recordEmail({ to, subject, kind: "intake-invite", caseId, caseTitle, actor, status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "intake-invite", caseId, caseTitle, actor, status: "failed", error: String(e) });
    throw e;
  }
}

export async function sendUserInviteEmail({
  to,
  name,
  inviteUrl,
  invitedBy,
  expiryDays = 7,
  actor,
}: {
  to: string;
  name: string;
  inviteUrl: string;
  invitedBy: string;
  expiryDays?: number;
  actor?: SessionPayload | null;
}): Promise<void> {
  const subject = `You've been invited to join petitionhq.us`;

  const text = `Hi ${name},

${invitedBy} has invited you to join petitionhq.us as an attorney.

Click the link below to set your password and activate your account. No other action is needed.

Activate account (valid for ${expiryDays} days):
${inviteUrl}

If you weren't expecting this invitation, you can safely ignore this email.`;

  const html = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a;line-height:1.7">
      <p>Hi ${esc(name)},</p>
      <p><strong>${invitedBy}</strong> has invited you to join <strong>petitionhq.us</strong> as an attorney.</p>
      <p>Click the button below to set your password and activate your account. No login or existing account is required.</p>
      <div style="margin:28px 0;text-align:center">
        <a href="${inviteUrl}"
           style="background:#1c1917;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-family:system-ui;font-size:15px">
          Activate account
        </a>
      </div>
      <p style="font-size:14px;color:#555">This link is valid for ${expiryDays} days.</p>
      <p style="font-size:14px;color:#555">
        If the button doesn't work, copy this URL into your browser:<br/>
        <span style="color:#1c1917">${inviteUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0"/>
      <p style="font-size:13px;color:#78716c">
        If you weren't expecting this invitation, you can safely ignore this email.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html,
    });
    recordEmail({ to, subject, kind: "user-invite", actor, status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "user-invite", actor, status: "failed", error: String(e) });
    throw e;
  }
}

export async function sendBetaInviteEmail({
  to,
  name,
  inviteUrl,
  expiryDays = 7,
  actor,
}: {
  to: string;
  name: string;
  inviteUrl: string;
  expiryDays?: number;
  actor?: SessionPayload | null;
}): Promise<void> {
  const subject = `You're invited: free beta of our petition drafting software`;

  const text = `Hi ${name},

You completed our NIW assessment, and we'd like to invite you into a free beta of our document-preparation software — the same drafting tools our partner attorneys use.

We are not a law firm and this is not legal advice. You remain solely responsible for your own filing, and we recommend consulting a licensed attorney. Full details are in our Terms of Service.

Set your password to get started (valid for ${expiryDays} days):
${inviteUrl}

What's included, free during the beta:
- Your assessment and gap narrative
- Recommendation letter drafts via the real recommender portal
- A petition-brief draft you can export
- Evidence and exhibit organization

If you have any questions, just reply to this email — a real person reads every reply.`;

  const html = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1a1a1a;line-height:1.7">
      <p>Hi ${esc(name)},</p>
      <p>You completed our NIW assessment, and we'd like to invite you into a <strong>free beta</strong> of our
         document-preparation software — the same drafting tools our partner attorneys use.</p>
      <p style="font-size:14px;color:#555"><strong>We are not a law firm and this is not legal advice.</strong>
         You remain solely responsible for your own filing, and we recommend consulting a licensed attorney.
         Full details are in our Terms of Service.</p>
      <div style="margin:28px 0;text-align:center">
        <a href="${inviteUrl}"
           style="background:#1c1917;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-family:system-ui;font-size:15px">
          Set my password →
        </a>
      </div>
      <p style="font-size:14px;color:#555"><strong>What's included, free during the beta:</strong></p>
      <ul style="font-size:14px;color:#555;margin:0;padding-left:20px">
        <li>Your assessment and gap narrative</li>
        <li>Recommendation letter drafts via the real recommender portal</li>
        <li>A petition-brief draft you can export</li>
        <li>Evidence and exhibit organization</li>
      </ul>
      <p style="font-size:14px;color:#555;margin-top:16px">This link is valid for ${expiryDays} days.</p>
      <p style="font-size:14px;color:#555">
        If the button doesn't work, copy this URL into your browser:<br/>
        <span style="color:#1c1917">${inviteUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e7e5e4;margin:24px 0"/>
      <p style="font-size:13px;color:#78716c">
        If you weren't expecting this invitation, you can safely ignore this email.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html,
    });
    recordEmail({ to, subject, kind: "beta-invite", actor, status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "beta-invite", actor, status: "failed", error: String(e) });
    throw e;
  }
}
