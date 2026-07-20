import { prisma } from "../prisma";
import {
  transporter,
  resolveRecipient,
  recordEmail,
  emailWrapper,
  esc,
  logger,
  BASE_URL,
  TIER_LABEL_ADMIN,
  TIER_LABEL_APPLICANT,
  TIER_EMOJI,
} from "./transport";

// ─── Attorney network notification ────────────────────────────────────────────

export async function sendLeadNotification({
  to,
  leadId,
  tier,
  field,
  hasVerification,
  trustScore,
  previewToken,
}: {
  to: string;
  leadId: string;
  tier: string;
  field: string;
  hasVerification?: boolean;
  trustScore?: number;
  previewToken?: string;
}) {
  const url = previewToken
    ? `${BASE_URL}/leads/${leadId}?token=${previewToken}`
    : `${BASE_URL}/leads/${leadId}`;
  const verificationUrl = `${BASE_URL}/api/leads/${leadId}/verification-report`;
  const tierLabel = TIER_LABEL_ADMIN[tier] ?? tier;
  const isStrong = tier === "tier1";
  const subject = `New ${isStrong ? "strong" : "developing"} lead available — ${field}`;

  const verificationLine = hasVerification
    ? `\nVerification report: ${verificationUrl}\nCredentials independently confirmed via public databases (OpenAlex, ORCID, ROR, NSF, NIH, USPTO).${trustScore ? ` Trust score: ${trustScore}/100.` : ""}\n`
    : "";

  const text = `A new EB-2 NIW lead is available in your network.

Field: ${field}
Tier: ${tierLabel}
${verificationLine}
Review their petition draft and claim the case:
${url}

This case is first-come, first-served. The link is valid for 72 hours.

— petitionhq.us`;

  // NEEDS FOUNDER REVIEW: "Publicly Corroborated" label in attorney notification email
  const verificationHtml = hasVerification
    ? `<tr>
        <td style="padding:8px 0;color:#78716c;border-bottom:1px solid #f5f5f4">Publicly Corroborated</td>
        <td style="padding:8px 0;border-bottom:1px solid #f5f5f4">
          <span style="background:#dcfce7;color:#166534;padding:3px 10px;border-radius:20px;font-size:13px;font-weight:600">
            Trust: ${trustScore ?? "—"}/100
          </span>
          &nbsp;
          <a href="${verificationUrl}" style="color:#3b82f6;font-size:13px;text-decoration:none">View report</a>
        </td>
      </tr>`
    : "";

  const html = emailWrapper(`
    <p style="font-size:16px;font-weight:600;color:#1c1917;margin-bottom:4px">New lead available</p>
    <p style="margin:0 0 24px;color:#57534e;font-size:14px">First-come, first-served · 72 hours to claim</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:28px">
      <tr>
        <td style="padding:8px 0;color:#78716c;width:80px;border-bottom:1px solid #f5f5f4">Field</td>
        <td style="padding:8px 0;font-weight:600;color:#1c1917;border-bottom:1px solid #f5f5f4">${field}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#78716c${hasVerification ? ";border-bottom:1px solid #f5f5f4" : ""}">Tier</td>
        <td style="padding:8px 0${hasVerification ? ";border-bottom:1px solid #f5f5f4" : ""}">
          <span style="background:${isStrong ? "#dcfce7" : "#fef9c3"};color:${isStrong ? "#166534" : "#854d0e"};padding:3px 10px;border-radius:20px;font-size:13px;font-weight:600">
            ${tierLabel}
          </span>
        </td>
      </tr>
      ${verificationHtml}
    </table>
    <div style="margin:0 0 24px">
      <a href="${url}" style="background:#1c1917;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;font-family:system-ui;font-size:14px;font-weight:600;display:inline-block">
        Review petition draft &amp; claim →
      </a>
    </div>
    <p style="font-size:13px;color:#78716c">
      ${hasVerification
        ? "Attached: AI-assisted petition draft and API verification report. Credentials independently confirmed via public databases."
        : "A full AI-assisted petition draft is ready for your review."
      }
      Claims are one-click — no commitment until you decide to proceed with the applicant.
    </p>
  `);

  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>", to: resolveRecipient(to), subject, text, html });
    recordEmail({ to, subject, kind: "lead-notification", status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "lead-notification", status: "failed", error: String(e) });
    throw e;
  }
}

// ─── Consent confirmation (after "Request Attorney Match") ───────────────────

/**
 * Sent to the applicant immediately after they click "Request Attorney Match"
 * on the result page. Confirms the profile is in the queue, sets an honest
 * "no fixed timeline / no contact unless a firm opts in" expectation (we are
 * still onboarding firms — there is no attorney standing by), and reinforces
 * the double opt-in boundary.
 */
export async function sendConsentConfirmation({
  to,
  name,
}: {
  to: string;
  name?: string | null;
}) {
  const greeting = name ? `Hi ${esc(name)},` : "Hi,";
  const subject = "Your EB-2 NIW profile is in the attorney-matching queue";

  const text = `${name ? `Hi ${name},` : "Hi,"}

Thanks for opting in. Your redacted profile and evidence summary are now in our attorney-matching queue.

Being upfront: we're onboarding vetted NIW firms right now, so there's no fixed timeline and no attorney is standing by. Here's how it works:

1. We're building a network of boutique immigration firms that specialize in fields like yours.
2. If a firm wants to take your case, they request to claim your lead — and only then.
3. At that point, you receive an email asking for your final approval. Your contact information stays completely hidden until you explicitly approve that specific attorney.

You've made no commitments, and no payment is required. No firm can contact you unless you approve them first.

We'll email you the moment a firm requests to connect.

— petitionhq.us`;

  const html = emailWrapper(`
    <p style="font-size:16px;font-weight:600;color:#1c1917;margin-bottom:16px">Your profile is in the attorney-matching queue</p>
    <p>${greeting}</p>
    <p style="font-size:15px">
      Thanks for opting in. Your redacted profile and evidence summary are now in our
      attorney-matching queue. Being upfront: we're onboarding vetted NIW firms right now, so
      there's no fixed timeline and no attorney is standing by.
    </p>

    <p style="font-weight:600;margin-top:24px;margin-bottom:12px">How it works:</p>
    <ol style="padding-left:20px;color:#44403c;font-size:14px;line-height:2">
      <li>We're building a network of boutique immigration firms that specialize in fields like yours.</li>
      <li>If a firm wants to take your case, they request to claim your lead — and only then.</li>
      <li><strong>You will receive an email asking for your final approval.</strong> Your contact information stays completely hidden until you explicitly approve that specific attorney.</li>
    </ol>

    <p style="font-size:14px;color:#57534e;margin-top:20px">
      You've made no commitments, and no payment is required. No firm can contact you unless you
      approve them first — we'll email you the moment one requests to connect.
    </p>

    <p style="font-size:12px;color:#a8a29e;margin-top:28px">
      You are receiving this because you requested an attorney match on petitionhq.us.
      Your contact info is hidden until you approve a specific attorney.
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
    recordEmail({ to, subject, kind: "consent-confirmation", status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "consent-confirmation", status: "failed", error: String(e) });
    logger.error("[consent-confirmation] email failed:", e);
  }
}

// ─── Lead confirmation (after assessment) ─────────────────────────────────────

/**
 * Sent to the applicant right after their assessment is saved.
 * Tier-specific copy. Score only shown for tier1.
 *
 * `isPreliminary` distinguishes the two LLM passes the funnel runs:
 *  - true  → the 5-question gate pass, which ASSUMES median values for every
 *            deep field not yet answered (national importance, US plan,
 *            employer, peer review). The prong numbers here are provisional and
 *            will move once the full intake is done. This email MUST say so —
 *            otherwise it contradicts the harsher full read on the result page.
 *  - false → the post-deep-intake pass: the real, complete read. Same
 *            dimensions the result page renders.
 * See app/api/check/route.ts (preliminary median defaults) and the funnel in
 * app/check/page.tsx (gate = preliminary, deep-complete = final).
 */
export async function sendLeadConfirmation({
  to,
  name,
  tier,
  resultToken,
  dimensions,
  gapNarrative,
  summary,
  isPreliminary = false,
}: {
  to: string;
  name?: string | null;
  tier: string;
  resultToken: string;
  dimensions?: { label: string; score: number; notes?: string }[];
  gapNarrative?: { strengths?: string; blockers?: string; legalLeverage?: string };
  summary?: string;
  isPreliminary?: boolean;
}) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const greetingHtml = name ? `Hi ${esc(name)},` : "Hi,";
  const tierLabel = TIER_LABEL_APPLICANT[tier] ?? "Case on file";
  const resultUrl  = `${BASE_URL}/results/${resultToken}`;

  // Honest preamble. A preliminary read is a snapshot built on median
  // assumptions for unanswered questions; we say so plainly so the refined
  // (often lower) full read can't read as a contradiction.
  const completeLine = isPreliminary
    ? "Here's your preliminary EB-2 NIW read, based on your first few answers."
    : "Your EB-2 NIW assessment is complete. Here's what we found.";
  const prelimNoticeHtml = isPreliminary
    ? `<p style="margin:14px 0 0;font-size:12px;color:#a8a29e;line-height:1.6">
         <strong>Preliminary</strong> — for the questions you haven't answered yet
         (national-importance connection, US plan, employer situation, peer review),
         this assumes typical values for your degree and publication record. The prong
         scores below are provisional and are refined — often downward — once you
         complete the full intake.
       </p>`
    : "";
  const prelimNoticeText = isPreliminary
    ? "\n\n(Preliminary — for questions you haven't answered yet, this assumes typical values for your degree and publication record. The prong scores below are provisional and get refined once you complete the full intake.)"
    : "";

  // Tier-specific messaging
  const tierBlurb =
    tier === "tier1"
      ? `You're in the strong minority — the kind of profile that still holds up even as NIW approvals fall toward 1 in 3. The risk now isn't your credentials; it's a filing that doesn't do them justice.`
      : tier === "tier2"
      ? `Real promise — but not a slam dunk. In today's climate, "promising" is exactly the band that gets RFE'd or denied when the framing is weak. The good news: the gap is usually fixable, and it's spelled out in your full read.`
      : `Honestly? Not yet. The foundation is there, but filing now would most likely mean a denial and 6+ months lost. Better to hear that from us than from USCIS — here's the roadmap to change it.`;

  const nextSteps =
    tier === "tier1"
      ? [
          "Open your full read — your strongest prongs, plus the one or two places even strong cases still get RFE'd.",
          "Want a human in the loop? Attorney matching is optional — you decide, after you've seen everything.",
          "Re-check anytime your record changes — it re-runs against your real publications.",
        ]
      : tier === "tier2"
      ? [
          "Open your full read — it names the exact prong dragging your case down, and what stronger cases do differently.",
          "Most \"developing\" cases lose on national-importance framing, not citation count — and that part is fixable.",
          "Re-take it anytime your record improves; it re-checks your real publications automatically.",
        ]
      : [
          "Build publications + citations, and tie your work to a named US priority (health, energy, AI, security).",
          "Re-assess in 3–6 months — the tool re-checks your real record automatically.",
          "Better to hear \"not yet\" here than from a $15,000 denial six months in.",
        ];

  const subject = isPreliminary
    ? `Your preliminary NIW read — complete your intake for the full picture`
    : tier === "tier1"
      ? `Your NIW read: you're in the strong minority`
      : tier === "tier2"
      ? `Your NIW read: promising — but here's what would sink it`
      : `Your NIW read: not yet — and exactly why`;

  const dimText = dimensions && dimensions.length > 0
    ? "\n\nScore breakdown:\n" + dimensions.map((d) => `  ${d.label}: ${d.score}/100`).join("\n")
    : "";

  const gapText = gapNarrative
    ? [
        gapNarrative.strengths ? `\nStrengths:\n${gapNarrative.strengths}` : "",
        gapNarrative.blockers ? `\nKey gaps:\n${gapNarrative.blockers}` : "",
        gapNarrative.legalLeverage ? `\nHow stronger cases fix this:\n${gapNarrative.legalLeverage}` : "",
      ].join("")
    : "";

  const text = `${greeting}

${isPreliminary ? "Here's your preliminary EB-2 NIW read, based on your first few answers." : "Your EB-2 NIW assessment is complete."}${prelimNoticeText}

Assessment: ${tierLabel}
${summary ? `\n${summary}` : ""}${dimText}${gapText}

${nextSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

View your full assessment: ${resultUrl}

— petitionhq.us`;

  // Build AI assessment section (dimensions + gap narrative)
  const dimHtml = dimensions && dimensions.length > 0
    ? `<p style="font-weight:600;font-size:13px;color:#1c1917;margin:24px 0 ${isPreliminary ? "2px" : "10px"}">Score breakdown${isPreliminary ? `<span style="font-weight:400;color:#a8a29e"> · provisional</span>` : ""}</p>
       ${isPreliminary ? `<p style="margin:0 0 10px;font-size:11px;color:#a8a29e">Assumes typical values for questions not yet answered.</p>` : ""}
       <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
         ${dimensions.map((d) => `
           <tr>
             <td style="padding:5px 0;font-size:13px;color:#44403c;width:52%">${esc(d.label)}</td>
             <td style="padding:5px 0;width:36%">
               <div style="background:#e7e5e4;border-radius:3px;height:5px">
                 <div style="background:#1c1917;border-radius:3px;height:5px;width:${Math.min(d.score, 100)}%"></div>
               </div>
             </td>
             <td style="padding:5px 0 5px 8px;font-size:12px;color:#78716c;width:12%;white-space:nowrap">${d.score}/100</td>
           </tr>`).join("")}
       </table>`
    : "";

  const gapHtml = gapNarrative
    ? [
        gapNarrative.strengths
          ? `<div style="margin-top:14px"><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.5px">Strengths</p><p style="margin:0;font-size:14px;color:#44403c;line-height:1.6">${esc(gapNarrative.strengths)}</p></div>`
          : "",
        gapNarrative.blockers
          ? `<div style="margin-top:12px"><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.5px">Key gaps</p><p style="margin:0;font-size:14px;color:#44403c;line-height:1.6">${esc(gapNarrative.blockers)}</p></div>`
          : "",
        gapNarrative.legalLeverage
          ? `<div style="margin-top:12px"><p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:0.5px">How stronger cases fix this</p><p style="margin:0;font-size:14px;color:#44403c;line-height:1.6">${esc(gapNarrative.legalLeverage)}</p></div>`
          : "",
      ].join("")
    : "";

  const aiSection = (dimHtml || gapHtml || summary)
    ? `<div style="background:#f9f8f7;border-radius:10px;padding:18px 20px;margin:20px 0">
         ${summary ? `<p style="margin:0 0 14px;font-size:14px;color:#44403c;line-height:1.6;font-style:italic">${esc(summary)}</p>` : ""}
         ${dimHtml}
         ${gapHtml}
       </div>`
    : "";

  const html = emailWrapper(`
    <p>${greetingHtml}</p>
    <p>${completeLine}</p>

    <div style="background:#f5f5f4;border-radius:10px;padding:20px 24px;margin:24px 0;border-left:3px solid #1c1917">
      <p style="margin:0 0 4px;font-size:13px;color:#78716c;text-transform:uppercase;letter-spacing:1px">${isPreliminary ? "Preliminary result" : "Assessment result"}</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#1c1917">${tierLabel}</p>
      ${prelimNoticeHtml}
    </div>

    <p style="font-size:15px">${tierBlurb}</p>

    ${aiSection}

    <p style="font-weight:600;margin-top:28px;margin-bottom:12px">
      ${tier === "tier1" ? "What happens next:" : tier === "tier2" ? "Your next steps:" : "How to strengthen your case:"}
    </p>
    <ol style="padding-left:20px;color:#44403c;font-size:14px;line-height:2">
      ${nextSteps.map((s) => `<li>${s}</li>`).join("")}
    </ol>

    <div style="margin:28px 0">
      <a href="${resultUrl}" style="background:#1c1917;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-family:system-ui;font-size:14px;font-weight:600;display:inline-block">
        See your full honest read →
      </a>
      ${tier === "tier3" ? `&nbsp;&nbsp;<a href="${BASE_URL}/check" style="background:#fff;color:#1c1917;padding:12px 28px;border-radius:6px;text-decoration:none;font-family:system-ui;font-size:14px;font-weight:600;display:inline-block;border:1.5px solid #1c1917">Re-assess anytime →</a>` : ""}
    </div>

    <p style="font-size:13px;color:#78716c;margin-top:8px">
      No account needed. Your assessment is saved and accessible anytime.
    </p>
    <p style="font-size:13px;color:#78716c;margin-top:14px;border-top:1px solid #e7e5e4;padding-top:14px">
      Know someone else weighing an NIW? Send them their own honest read:
      <a href="${BASE_URL}/check" style="color:#1c1917;font-weight:600;text-decoration:none">${BASE_URL.replace(/^https?:\/\//, "")}/check</a>
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
    recordEmail({ to, subject, kind: "lead-confirmation", status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "lead-confirmation", status: "failed", error: String(e) });
    logger.error("[lead-confirmation] email failed:", e);
  }
}

// ─── Admin alert ───────────────────────────────────────────────────────────────

/**
 * Sent to admin (ADMIN_EMAIL) when a new lead is created.
 */
export async function sendLeadAdminAlert({
  leadId,
  email,
  name,
  score,
  tier,
  field,
}: {
  leadId: string;
  email: string;
  name?: string | null;
  score?: number | null;
  tier: string;
  field?: string;
}) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

  const emoji = TIER_EMOJI[tier] ?? "⚪";
  const tierLabel = TIER_LABEL_ADMIN[tier] ?? tier;
  const subject = `New lead — ${tierLabel}${field ? ` · ${field}` : ""}`;
  const url = `${BASE_URL}/leads/${leadId}`;

  const text = `New NIW lead captured.\n\nName: ${name ?? "(not provided)"}\nEmail: ${email}\nTier: ${tierLabel}\nField: ${field ?? "—"}\n\nView: ${url}`;

  const html = `
    <div style="font-family:system-ui;max-width:480px;margin:0 auto;color:#1a1a1a">
      <p style="font-size:17px;font-weight:600;margin-bottom:16px">${emoji} New NIW lead</p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        <tr><td style="padding:6px 0;color:#78716c;width:80px">Name</td><td><strong>${esc(name ?? "(not provided)")}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#78716c">Email</td><td>${esc(email)}</td></tr>
        <tr><td style="padding:6px 0;color:#78716c">Tier</td><td>${esc(tierLabel)}</td></tr>
        ${field ? `<tr><td style="padding:6px 0;color:#78716c">Field</td><td>${esc(field)}</td></tr>` : ""}
      </table>
      <div style="margin:20px 0">
        <a href="${url}" style="background:#1c1917;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">
          View lead →
        </a>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>",
      to: adminEmail,
      subject,
      text,
      html,
    });
    recordEmail({ to: adminEmail, subject, kind: "lead-admin-alert", status: "sent" });
  } catch (e) {
    recordEmail({ to: adminEmail, subject, kind: "lead-admin-alert", status: "failed", error: String(e) });
    logger.error("[lead-admin-alert] email failed:", e);
  }
}

// ─── Attorney claimed (legacy — kept for compatibility) ───────────────────────

export async function sendLeadClaimed({
  to,
  leadId,
  attorneyName,
}: {
  to: string;
  leadId: string;
  attorneyName: string;
}) {
  const url = `${BASE_URL}/leads/${leadId}`;
  const subject = `${attorneyName} reviewed your NIW profile — petitionhq.us`;
  const text = `${attorneyName} has reviewed your EB-2 NIW profile and would like to represent you.\n\nYou'll receive a separate email shortly asking you to confirm or decline. No action is needed right now.\n\nView your assessment: ${url}`;
  const html = emailWrapper(`
    <p><strong>${esc(attorneyName)}</strong> has reviewed your EB-2 NIW profile.</p>
    <p>You'll receive a separate email shortly asking you to confirm or decline representation. <strong>No action is needed right now.</strong></p>
    <div style="margin:24px 0">
      <a href="${url}" style="background:#1c1917;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-family:system-ui;font-size:14px;font-weight:600;display:inline-block">
        View your assessment →
      </a>
    </div>
  `);
  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>", to: resolveRecipient(to), subject, text, html });
    recordEmail({ to, subject, kind: "lead-claimed", status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "lead-claimed", status: "failed", error: String(e) });
    throw e;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * One-time consent nudge for marketplace-ready (M7) leads that never opted in
 * to attorney matching. Links to the applicant's own results page, where the
 * one-click ConsentCard lives — no new consent mechanics. The copy promises
 * "we won't ask again", so the caller must enforce send-once (EmailLog dedupe).
 */
export async function sendConsentNudge({
  to,
  name,
  field,
  resultToken,
}: {
  to: string;
  name?: string | null;
  field?: string | null;
  resultToken: string;
}) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const fieldLabel = field?.trim() || "your field";
  const resultUrl = `${BASE_URL}/results/${resultToken}`;
  const subject = "Your NIW profile qualifies for attorney matching — one step left";

  const text = `${greeting}

When you assessed your EB-2 NIW profile on PetitionHQ, you didn't opt in to attorney matching — so your profile stays invisible to the immigration attorneys on our network.

Your profile qualifies: your research record was corroborated against public sources (OpenAlex, ORCID, federal grant databases and more), which is the first thing attorneys look for.

If you'd like an NIW attorney working in ${fieldLabel} to review your profile and reach out about a free consultation, approve matching from your results page:

${resultUrl}

Nothing is shared with any attorney until you approve, and approving doesn't commit you to anything. If you're not interested, ignore this email — we won't ask again.

— petitionhq.us`;

  const html = emailWrapper(`
    <p>${name ? `Hi ${esc(name)},` : "Hi,"}</p>
    <p>
      When you assessed your EB-2 NIW profile on PetitionHQ, you didn't opt in to
      attorney matching — so your profile stays <strong>invisible</strong> to the
      immigration attorneys on our network.
    </p>
    <p>
      Your profile qualifies: your research record was corroborated against public
      sources (OpenAlex, ORCID, federal grant databases and more), which is the
      first thing attorneys look for.
    </p>
    <p>
      If you'd like an NIW attorney working in <strong>${esc(fieldLabel)}</strong> to review
      your profile and reach out about a <strong>free consultation</strong>, approve matching
      from your results page:
    </p>
    <div style="margin:28px 0">
      <a href="${resultUrl}"
         style="background:#1c1917;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;font-family:system-ui;font-size:14px;font-weight:600;display:inline-block">
        Review &amp; approve matching →
      </a>
    </div>
    <p style="font-size:12px;color:#a8a29e;margin-top:16px">
      Nothing is shared with any attorney until you approve, and approving doesn't
      commit you to anything. Not interested? Ignore this email — we won't ask again.
    </p>
  `);

  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>", to: resolveRecipient(to), subject, text, html });
    recordEmail({ to, subject, kind: "consent-nudge", status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "consent-nudge", status: "failed", error: String(e) });
    throw e;
  }
}

export type EmailLogEntry = {
  id: string;
  to: string;
  subject: string;
  kind: string;
  caseId: string | null;
  caseTitle: string | null;
  actorId: string | null;
  actorName: string | null;
  status: string;
  error: string | null;
  createdAt: string;
};

// ─── Claim consent / rejection ────────────────────────────────────────────────

/**
 * Sent to applicant when an attorney claims their lead.
 * Includes approve / reject links so they can consent or decline.
 */
export async function sendLeadClaimConsent({
  to,
  name,
  attorneyName,
  firmName,
  respondToken,
  calendlyUrl,
}: {
  to: string;
  name?: string | null;
  attorneyName: string;
  firmName?: string | null;
  respondToken: string;
  calendlyUrl?: string | null;
}) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const firm = firmName ? `, ${firmName}` : "";
  const approveUrl = `${BASE_URL}/respond?token=${respondToken}&action=approve`;
  const rejectUrl  = `${BASE_URL}/respond?token=${respondToken}&action=reject`;
  const subject = `${attorneyName} reviewed your NIW profile and wants to connect`;

  const bookingLine = calendlyUrl
    ? `\nSchedule a strategy call: ${calendlyUrl}\n`
    : "";

  const text = `${greeting}

Good news — ${attorneyName}${firm} has reviewed your EB-2 NIW profile and believes they can build a strong case for you.

They'd like to schedule a free 30-minute strategy call to walk through your profile, explain the NIW process, and outline what a petition would look like for your background.

No commitment. No fees at this stage.
${bookingLine}
→ Accept and connect: ${approveUrl}
→ Not interested right now: ${rejectUrl}

This link expires in 7 days. If you have questions, just reply to this email.

— petitionhq.us`;

  const bookingBlock = calendlyUrl ? `
    <div style="margin:20px 0;padding:16px 20px;border-radius:8px;background:#f0fdf4;border:1px solid #bbf7d0">
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#166534">Schedule a strategy call</p>
      <a href="${calendlyUrl}"
         style="color:#15803d;font-size:14px;text-decoration:underline;word-break:break-all">${calendlyUrl}</a>
    </div>` : "";

  const html = emailWrapper(`
    <p>${name ? `Hi ${esc(name)},` : "Hi,"}</p>
    <p>Good news.</p>
    <p>
      <strong>${esc(attorneyName)}${firmName ? `, ${esc(firmName)}` : ""}</strong> reviewed your EB-2 NIW profile and believes
      they can build a strong case for you.
    </p>
    <p>They'd like to schedule a <strong>free 30-minute strategy call</strong> to:</p>
    <ul style="font-size:14px;line-height:2;color:#44403c;padding-left:20px">
      <li>Walk through your profile and explain your options</li>
      <li>Identify which parts of your background are strongest for NIW</li>
      <li>Give you an honest assessment of timing and likelihood</li>
    </ul>
    <p style="font-size:14px;color:#57534e">
      <strong>No commitment. No fees at this stage.</strong> You decide whether to proceed after the call.
    </p>
    ${bookingBlock}
    <div style="margin:28px 0;display:flex;gap:12px">
      <a href="${approveUrl}"
         style="background:#1c1917;color:#fff;padding:13px 28px;border-radius:6px;text-decoration:none;font-family:system-ui;font-size:14px;font-weight:600;display:inline-block;margin-right:12px">
        Yes, connect me →
      </a>
      <a href="${rejectUrl}"
         style="background:#fff;color:#78716c;padding:13px 20px;border-radius:6px;text-decoration:none;font-family:system-ui;font-size:14px;border:1px solid #d6d3d1;display:inline-block">
        Not now
      </a>
    </div>
    <p style="font-size:12px;color:#a8a29e;margin-top:16px">
      This link expires in 7 days. ${esc(attorneyName)} will not contact you unless you accept above.
    </p>
  `);

  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>", to: resolveRecipient(to), subject, text, html });
    recordEmail({ to, subject, kind: "lead-claim-consent", status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "lead-claim-consent", status: "failed", error: String(e) });
    throw e;
  }
}

/**
 * Sent to the attorney when applicant rejects their claim.
 */
export async function sendClaimRejectedNotice({
  to,
  attorneyName,
  applicantName,
  note,
}: {
  to: string;
  attorneyName: string;
  applicantName?: string | null;
  note?: string | null;
}) {
  const subject = `Applicant declined your representation — petitionhq.us`;
  const who = applicantName ?? "The applicant";
  const text = `Hi ${attorneyName},\n\n${who} has declined your representation request.${note ? `\n\nTheir note: "${note}"` : ""}\n\nThe lead has been released back to the pool. Your credit has not been refunded.\n\n— petitionhq.us`;
  const html = `<p>Hi ${esc(attorneyName)},</p><p>${esc(who)} has declined your representation request.${note ? `<br/><em>&ldquo;${esc(note)}&rdquo;</em>` : ""}</p><p>The lead has been released back to the pool. Your credit has not been refunded.</p>`;

  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>", to: resolveRecipient(to), subject, text, html });
    recordEmail({ to, subject, kind: "claim-rejected-notice", status: "sent" });
  } catch (e) {
    recordEmail({ to, subject, kind: "claim-rejected-notice", status: "failed", error: String(e) });
    throw e;
  }
}

// ─── Email log query ──────────────────────────────────────────────────────────

export async function listEmailLog(limit = 200): Promise<EmailLogEntry[]> {
  const rows = await prisma.emailLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
