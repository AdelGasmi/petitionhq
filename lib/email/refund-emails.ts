import {
  transporter,
  resolveRecipient,
  recordEmail,
  emailWrapper,
  esc,
  logger,
  BASE_URL,
} from "./transport";

// ─── Refund request submitted — notify admin ────────────────────────────────

export async function sendRefundRequestAdminAlert({
  caseId,
  attorneyName,
  reason,
  explanation,
}: {
  caseId: string;
  attorneyName: string;
  reason: string;
  explanation: string;
}) {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@petitionhq.us";
  const url = `${BASE_URL}/admin/refunds`;
  const subject = `Refund request — ${reason.replace(/_/g, " ")} (case ${caseId.slice(0, 8)})`;

  const text = `Attorney ${attorneyName} requested a refund for case ${caseId.slice(0, 8)}.

Reason: ${reason.replace(/_/g, " ")}
Explanation: ${explanation}

Review and decide: ${url}`;

  const html = emailWrapper(`
    <h2 style="font-size:20px;margin:0 0 16px">Refund Request</h2>
    <p>Attorney <strong>${esc(attorneyName)}</strong> requested a refund for case <code>${esc(caseId.slice(0, 8))}</code>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr>
        <td style="padding:8px 12px;background:#fafaf9;border:1px solid #e7e5e4;font-size:13px;color:#78716c;width:120px">Reason</td>
        <td style="padding:8px 12px;border:1px solid #e7e5e4;font-size:14px">${esc(reason.replace(/_/g, " "))}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#fafaf9;border:1px solid #e7e5e4;font-size:13px;color:#78716c">Explanation</td>
        <td style="padding:8px 12px;border:1px solid #e7e5e4;font-size:14px">${esc(explanation)}</td>
      </tr>
    </table>
    <p><a href="${url}" style="color:#3b82f6">Review in admin dashboard →</a></p>
  `);

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <noreply@petitionhq.us>",
      to: resolveRecipient(adminEmail),
      subject,
      text,
      html,
    });
    await recordEmail({ to: adminEmail, subject, kind: "refund_request_admin", status: "sent" });
  } catch (err) {
    logger.error("[email] sendRefundRequestAdminAlert failed:", err);
    await recordEmail({ to: adminEmail, subject, kind: "refund_request_admin", status: "failed", error: String(err) });
  }
}

// ─── Refund approved — notify attorney ──────────────────────────────────────

export async function sendRefundApprovedEmail({
  to,
  attorneyName,
  caseId,
  amountCents,
}: {
  to: string;
  attorneyName: string;
  caseId: string;
  amountCents: number;
}) {
  const amount = `$${(amountCents / 100).toFixed(2)}`;
  const subject = `Refund approved — ${amount} for case ${caseId.slice(0, 8)}`;

  const text = `Hi ${attorneyName},

Your refund request for case ${caseId.slice(0, 8)} has been approved.

Amount: ${amount}
The refund will appear on your original payment method within 5-10 business days.

The lead has been returned to the marketplace and is available for other attorneys.

— PetitionHQ`;

  const html = emailWrapper(`
    <h2 style="font-size:20px;margin:0 0 16px">Refund Approved</h2>
    <p>Hi ${esc(attorneyName)},</p>
    <p>Your refund request for case <code>${esc(caseId.slice(0, 8))}</code> has been approved.</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;font-size:14px;color:#15803d"><strong>${amount}</strong> will be refunded to your original payment method within 5–10 business days.</p>
    </div>
    <p style="font-size:14px;color:#57534e">The lead has been returned to the marketplace and is available for other attorneys.</p>
  `);

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <noreply@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html,
    });
    await recordEmail({ to, subject, kind: "refund_approved", caseId, status: "sent" });
  } catch (err) {
    logger.error("[email] sendRefundApprovedEmail failed:", err);
    await recordEmail({ to, subject, kind: "refund_approved", caseId, status: "failed", error: String(err) });
  }
}

// ─── Refund denied — notify attorney ────────────────────────────────────────

export async function sendRefundDeniedEmail({
  to,
  attorneyName,
  caseId,
  decisionNotes,
}: {
  to: string;
  attorneyName: string;
  caseId: string;
  decisionNotes?: string;
}) {
  const subject = `Refund request denied — case ${caseId.slice(0, 8)}`;

  const text = `Hi ${attorneyName},

Your refund request for case ${caseId.slice(0, 8)} has been reviewed and denied.
${decisionNotes ? `\nReason: ${decisionNotes}\n` : ""}
If you believe this is an error, please reply to this email.

— PetitionHQ`;

  const notesHtml = decisionNotes
    ? `<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;font-size:14px;color:#92400e"><strong>Reason:</strong> ${esc(decisionNotes)}</p>
      </div>`
    : "";

  const html = emailWrapper(`
    <h2 style="font-size:20px;margin:0 0 16px">Refund Request Denied</h2>
    <p>Hi ${esc(attorneyName)},</p>
    <p>Your refund request for case <code>${esc(caseId.slice(0, 8))}</code> has been reviewed and denied.</p>
    ${notesHtml}
    <p style="font-size:14px;color:#57534e">If you believe this is an error, please reply to this email.</p>
  `);

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <noreply@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html,
    });
    await recordEmail({ to, subject, kind: "refund_denied", caseId, status: "sent" });
  } catch (err) {
    logger.error("[email] sendRefundDeniedEmail failed:", err);
    await recordEmail({ to, subject, kind: "refund_denied", caseId, status: "failed", error: String(err) });
  }
}

// ─── Ghost auto-refund — notify attorney ────────────────────────────────────

export async function sendGhostRefundEmail({
  to,
  attorneyName,
  caseId,
  amountCents,
}: {
  to: string;
  attorneyName: string;
  caseId: string;
  amountCents: number;
}) {
  const amount = `$${(amountCents / 100).toFixed(2)}`;
  const subject = `Auto-refund — applicant did not respond (case ${caseId.slice(0, 8)})`;

  const text = `Hi ${attorneyName},

The applicant for case ${caseId.slice(0, 8)} did not complete intake within 14 days. Per our guarantee, your claim payment of ${amount} has been automatically refunded.

The refund will appear on your original payment method within 5-10 business days. The lead has been returned to the marketplace.

— PetitionHQ`;

  const html = emailWrapper(`
    <h2 style="font-size:20px;margin:0 0 16px">Automatic Refund — Applicant Unresponsive</h2>
    <p>Hi ${esc(attorneyName)},</p>
    <p>The applicant for case <code>${esc(caseId.slice(0, 8))}</code> did not complete intake within 14 days.</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0;font-size:14px;color:#15803d">Per our guarantee, your claim payment of <strong>${amount}</strong> has been automatically refunded to your original payment method (5–10 business days).</p>
    </div>
    <p style="font-size:14px;color:#57534e">The lead has been returned to the marketplace and is available for other attorneys.</p>
  `);

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <noreply@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html,
    });
    await recordEmail({ to, subject, kind: "ghost_refund", caseId, status: "sent" });
  } catch (err) {
    logger.error("[email] sendGhostRefundEmail failed:", err);
    await recordEmail({ to, subject, kind: "ghost_refund", caseId, status: "failed", error: String(err) });
  }
}

// ─── Lead returned to marketplace — notify applicant ────────────────────────

export async function sendLeadReturnedEmail({
  to,
  applicantName,
}: {
  to: string;
  applicantName?: string;
}) {
  const name = applicantName ?? "there";
  const subject = "Your profile has been returned to the marketplace";

  const text = `Hi ${name},

Your profile has been returned to the attorney marketplace and is available for other attorneys to review.

This means a new attorney may reach out to discuss your EB-2 NIW petition. No action is needed on your part.

— PetitionHQ`;

  const html = emailWrapper(`
    <h2 style="font-size:20px;margin:0 0 16px">Profile Returned to Marketplace</h2>
    <p>Hi ${esc(name)},</p>
    <p>Your profile has been returned to the attorney marketplace and is available for other attorneys to review.</p>
    <p style="font-size:14px;color:#57534e">This means a new attorney may reach out to discuss your EB-2 NIW petition. No action is needed on your part.</p>
  `);

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <noreply@petitionhq.us>",
      to: resolveRecipient(to),
      subject,
      text,
      html,
    });
    await recordEmail({ to, subject, kind: "lead_returned", status: "sent" });
  } catch (err) {
    logger.error("[email] sendLeadReturnedEmail failed:", err);
    await recordEmail({ to, subject, kind: "lead_returned", status: "failed", error: String(err) });
  }
}
