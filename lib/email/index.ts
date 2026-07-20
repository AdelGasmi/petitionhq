// Barrel re-export — all consumers keep `import { … } from "@/lib/email"`
export {
  transporter,
  resolveRecipient,
  recordEmail,
  emailWrapper,
  BASE_URL,
  TIER_LABEL_ADMIN,
  TIER_LABEL_APPLICANT,
  TIER_EMOJI,
  logger,
} from "./transport";

export {
  sendLetterEmail,
  sendReviewInviteEmail,
  sendRecommenderNudgeEmail,
  sendNotificationEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendIntakeVerificationEmail,
  sendIntakeInviteEmail,
  sendUserInviteEmail,
  sendBetaInviteEmail,
} from "./platform-emails";

export {
  sendConsentConfirmation,
  sendLeadNotification,
  sendLeadConfirmation,
  sendLeadAdminAlert,
  sendLeadClaimed,
  sendLeadClaimConsent,
  sendClaimRejectedNotice,
  sendConsentNudge,
  listEmailLog,
} from "./lead-emails";
export type { EmailLogEntry } from "./lead-emails";

export {
  sendNurtureEmail,
  sendCaseFiledEmail,
} from "./nurture-emails";

export {
  sendRefundRequestAdminAlert,
  sendRefundApprovedEmail,
  sendRefundDeniedEmail,
  sendGhostRefundEmail,
  sendLeadReturnedEmail,
} from "./refund-emails";
