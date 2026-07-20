/**
 * Database layer — PostgreSQL via Prisma.
 * Public interface is identical to the old JSON-file version so all callers
 * remain unchanged.  Only this file knows about Prisma.
 */

import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { issueToken, verifyToken, consumeToken, revokeTokensFor, hasActiveToken, TTL } from "./tokens";
import { asClaimLedger, type ClaimLedger } from "./claimLedger";
import { encryptPiiFields, decryptPiiFields } from "./pii-crypto";

export function newId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Types (identical to before so all callers type-check without changes)
// ---------------------------------------------------------------------------

export type SectionComment = {
  id: string;
  sectionId: string;
  authorId: string;
  authorName: string;
  authorRole: "admin" | "attorney" | "applicant";
  text: string;
  createdAt: string;
  resolved: boolean;
};

export type LetterComment = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: "admin" | "attorney" | "applicant";
  text: string;
  createdAt: string;
  resolved: boolean;
};

export type Message = {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: "admin" | "attorney" | "applicant";
  text: string;
  createdAt: string;
  read: boolean;
};

export type QualityReport = {
  overallScore: number;
  dimensions: Record<string, { score: number; notes: string }>;
  weakParagraphs: { paragraph: string; issue: string }[];
  strengths: string[];
  readyToSend: boolean;
};

export type LetterVersion = {
  id: string;
  content: string;
  qualityReport?: QualityReport;
  createdAt: string;
  note?: string;
};

export type LetterRecord = {
  id: string;
  requirementId: string;
  recommender: {
    name: string;
    title: string;
    institution: string;
    credentials?: string;
    relationship?: string;
    kind?: "independent" | "dependent" | "academic" | "governmental";
    email?: string;
    country?: string;
  };
  selectedEvidence: string[];
  currentDraft?: string;
  qualityReport?: QualityReport;
  versions: LetterVersion[];
  comments: LetterComment[];
  reviewInviteSent: boolean;
  reviewerViewed?: string;
  reviewerSubmitted?: string;
  updatedAt: string;
};

export type DocumentRecord = {
  requirementId: string;
  status: "missing" | "pending" | "uploaded" | "validated";
  filename?: string;
  storedFilename?: string;
  mimeType?: string;
  size?: number;
  notes?: string;
  pastedText?: string;
  updatedAt: string;
};

export type Case = {
  id: string;
  formId: string;
  title: string;
  status: "draft" | "review" | "ready" | "filed";
  formData: Record<string, unknown>;
  /** Attorney curation gate. null/undefined ⇒ un-curated (all atoms allowed). */
  claimLedger?: ClaimLedger | null;
  documents: Record<string, DocumentRecord>;
  letters: Record<string, LetterRecord>;
  messages: Message[];
  sectionComments: SectionComment[];
  ownerId?: string;
  attorneyId?: string;
  reviewStatus?: "pending" | "accepted" | "declined";
  reviewRequestedAt?: string;
  reviewRespondedAt?: string;
  reviewNote?: string;
  paymentStatus: "unpaid" | "invoiced" | "paid";
  paymentNotes?: string;
  nextFollowUp?: string;
  nextAction?: string;
  filedAt?: string;
  lockedAt?: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Prisma include — always load full nested graph so mapCase works
// ---------------------------------------------------------------------------

const CASE_INCLUDE = {
  documents: { orderBy: { requirementId: "asc" as const } },
  letters: {
    include: {
      versions: { orderBy: { createdAt: "asc" as const } },
      comments: { orderBy: { createdAt: "asc" as const } },
    },
    orderBy: { updatedAt: "asc" as const },
  },
  messages: { orderBy: { createdAt: "asc" as const } },
  sectionComments: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.CaseInclude;

type PrismaCase = Prisma.CaseGetPayload<{ include: typeof CASE_INCLUDE }>;

// ---------------------------------------------------------------------------
// Mapper: Prisma row → domain Case
// ---------------------------------------------------------------------------

function mapCase(pc: PrismaCase): Case {
  const documents: Record<string, DocumentRecord> = {};
  for (const d of pc.documents) {
    documents[d.requirementId] = {
      requirementId: d.requirementId,
      status: d.status as DocumentRecord["status"],
      filename: d.filename ?? undefined,
      storedFilename: d.storedFilename ?? undefined,
      mimeType: d.mimeType ?? undefined,
      size: d.size ?? undefined,
      notes: d.notes ?? undefined,
      pastedText: d.pastedText ?? undefined,
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  const letters: Record<string, LetterRecord> = {};
  for (const l of pc.letters) {
    letters[l.id] = {
      id: l.id,
      requirementId: l.requirementId,
      recommender: l.recommender as LetterRecord["recommender"],
      selectedEvidence: l.selectedEvidence,
      currentDraft: l.currentDraft ?? undefined,
      qualityReport: (l.qualityReport ?? undefined) as QualityReport | undefined,
      versions: l.versions.map((v) => ({
        id: v.id,
        content: v.content,
        qualityReport: (v.qualityReport ?? undefined) as QualityReport | undefined,
        note: v.note ?? undefined,
        createdAt: v.createdAt.toISOString(),
      })),
      comments: l.comments.map((c) => ({
        id: c.id,
        authorId: c.authorId,
        authorName: c.authorName,
        authorRole: c.authorRole as "admin" | "attorney" | "applicant",
        text: c.text,
        resolved: c.resolved,
        createdAt: c.createdAt.toISOString(),
      })),
      reviewInviteSent: false,
      reviewerViewed: l.reviewerViewed?.toISOString() ?? undefined,
      reviewerSubmitted: l.reviewerSubmitted?.toISOString() ?? undefined,
      updatedAt: l.updatedAt.toISOString(),
    };
  }

  return {
    id: pc.id,
    formId: pc.formId,
    title: pc.title,
    status: pc.status as Case["status"],
    formData: decryptPiiFields(pc.formData as Record<string, unknown>),
    claimLedger: asClaimLedger(pc.claimLedger),
    documents,
    letters,
    messages: pc.messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.senderName,
      senderRole: m.senderRole as "admin" | "attorney" | "applicant",
      text: m.text,
      read: m.read,
      createdAt: m.createdAt.toISOString(),
    })),
    sectionComments: pc.sectionComments.map((sc) => ({
      id: sc.id,
      sectionId: sc.sectionId,
      authorId: sc.authorId,
      authorName: sc.authorName,
      authorRole: sc.authorRole as "admin" | "attorney" | "applicant",
      text: sc.text,
      resolved: sc.resolved,
      createdAt: sc.createdAt.toISOString(),
    })),
    ownerId: pc.ownerId ?? undefined,
    attorneyId: pc.attorneyId ?? undefined,
    reviewStatus: (pc.reviewStatus as Case["reviewStatus"]) ?? undefined,
    reviewRequestedAt: pc.reviewRequestedAt?.toISOString() ?? undefined,
    reviewRespondedAt: pc.reviewRespondedAt?.toISOString() ?? undefined,
    reviewNote: pc.reviewNote ?? undefined,
    paymentStatus: (pc.paymentStatus as Case["paymentStatus"]) ?? "unpaid",
    paymentNotes: pc.paymentNotes ?? undefined,
    nextFollowUp: pc.nextFollowUp?.toISOString() ?? undefined,
    nextAction: pc.nextAction ?? undefined,
    filedAt: pc.filedAt?.toISOString() ?? undefined,
    lockedAt: pc.lockedAt?.toISOString() ?? undefined,
    createdAt: pc.createdAt.toISOString(),
    updatedAt: pc.updatedAt.toISOString(),
  };
}

async function findCase(id: string): Promise<PrismaCase | null> {
  return prisma.case.findUnique({ where: { id }, include: CASE_INCLUDE });
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export async function listCases(filter?: {
  userId?: string;
  role?: "admin" | "attorney" | "applicant";
}): Promise<Case[]> {
  let where: Prisma.CaseWhereInput = {};
  if (filter?.role === "applicant" && filter.userId) {
    where = { ownerId: filter.userId };
  } else if (filter?.role === "attorney" && filter.userId) {
    where = { attorneyId: filter.userId };
  }
  // admin: no filter → all cases

  const rows = await prisma.case.findMany({
    where,
    include: CASE_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapCase);
}

/** Lightweight check: which of the given formIds does this owner already have a case for? */
export async function findCompanionCases(
  ownerId: string,
  formIds: string[]
): Promise<{ formId: string; id: string }[]> {
  const rows = await prisma.case.findMany({
    where: { ownerId, formId: { in: formIds } },
    select: { id: true, formId: true },
  });
  return rows.map((r) => ({ formId: r.formId, id: r.id }));
}

async function resolveReviewInvites(c: Case): Promise<Case> {
  const letterIds = Object.keys(c.letters);
  if (letterIds.length === 0) return c;
  const statuses = await Promise.all(
    letterIds.map((lid) => hasActiveToken("letter", lid, "letter_review")),
  );
  for (let i = 0; i < letterIds.length; i++) {
    c.letters[letterIds[i]].reviewInviteSent = statuses[i];
  }
  return c;
}

export async function readCase(id: string): Promise<Case | null> {
  const row = await findCase(id);
  if (!row) return null;
  return resolveReviewInvites(mapCase(row));
}

/**
 * Create a case from the admin dashboard or applicant onboarding flow.
 *
 * This is the "manual" path — admin picks formId/title/owner/attorney.
 * The lead-marketplace path uses autoConvertLead() in lib/lead-convert.ts,
 * which creates the case directly (with prefilled formData + auto-created
 * applicant User). The two paths share the same Prisma Case model but
 * intentionally diverge in pre/post logic (TD-1).
 */
export async function createCase(input: {
  formId: string;
  title: string;
  ownerId?: string;
  attorneyId?: string;
}): Promise<Case> {
  const row = await prisma.case.create({
    data: {
      formId: input.formId,
      title: input.title,
      ownerId: input.ownerId,
      attorneyId: input.attorneyId,
    },
    include: CASE_INCLUDE,
  });
  return mapCase(row);
}

export async function deleteCase(id: string): Promise<void> {
  await revokeTokensFor("case_record", id);
  const letters = await prisma.letter.findMany({ where: { caseId: id }, select: { id: true } });
  await Promise.all(letters.map((l) => revokeTokensFor("letter", l.id)));
  await prisma.case.delete({ where: { id } }).catch(() => {});
}

export async function patchFormData(
  caseId: string,
  updates: Record<string, unknown>
): Promise<Case | null> {
  const existing = await prisma.case.findUnique({ where: { id: caseId }, select: { formData: true } });
  if (!existing) return null;
  // Encrypt PII in the incoming updates before merging with existing (already-encrypted) data.
  const encryptedUpdates = encryptPiiFields(updates);
  const merged = { ...(existing.formData as Record<string, unknown>), ...encryptedUpdates };
  await prisma.case.update({ where: { id: caseId }, data: { formData: merged as Prisma.InputJsonValue } });
  return readCase(caseId);
}

export async function setDocumentStatus(
  caseId: string,
  requirementId: string,
  patch: Partial<DocumentRecord>
): Promise<Case | null> {
  await prisma.document.upsert({
    where: { caseId_requirementId: { caseId, requirementId } },
    update: {
      status: patch.status as never ?? undefined,
      filename: patch.filename,
      storedFilename: patch.storedFilename,
      mimeType: patch.mimeType,
      size: patch.size,
      notes: patch.notes,
      pastedText: patch.pastedText,
    },
    create: {
      caseId,
      requirementId,
      status: (patch.status as never) ?? "missing",
      filename: patch.filename,
      storedFilename: patch.storedFilename,
      mimeType: patch.mimeType,
      size: patch.size,
      notes: patch.notes,
      pastedText: patch.pastedText,
    },
  });
  await prisma.case.update({ where: { id: caseId }, data: { updatedAt: new Date() } });
  return readCase(caseId);
}

export async function upsertLetter(
  caseId: string,
  letter: LetterRecord
): Promise<Case | null> {
  // Find existing version IDs to avoid re-creating them
  const existingVersionIds = new Set(
    (await prisma.letterVersion.findMany({
      where: { letterId: letter.id },
      select: { id: true },
    })).map((v) => v.id)
  );

  const newVersions = letter.versions.filter((v) => !existingVersionIds.has(v.id));

  const toJsonNull = (v: unknown) => v ?? Prisma.JsonNull;

  await prisma.letter.upsert({
    where: { id: letter.id },
    update: {
      recommender: letter.recommender as Prisma.InputJsonValue,
      selectedEvidence: letter.selectedEvidence,
      currentDraft: letter.currentDraft ?? null,
      qualityReport: toJsonNull(letter.qualityReport),
      ...(newVersions.length > 0 && {
        versions: {
          create: newVersions.map((v) => ({
            id: v.id,
            content: v.content,
            qualityReport: toJsonNull(v.qualityReport),
            note: v.note ?? null,
            createdAt: new Date(v.createdAt),
          })),
        },
      }),
    },
    create: {
      id: letter.id,
      caseId,
      requirementId: letter.requirementId,
      recommender: letter.recommender as Prisma.InputJsonValue,
      selectedEvidence: letter.selectedEvidence,
      currentDraft: letter.currentDraft ?? null,
      qualityReport: toJsonNull(letter.qualityReport),
      versions: {
        create: letter.versions.map((v) => ({
          id: v.id,
          content: v.content,
          qualityReport: toJsonNull(v.qualityReport),
          note: v.note ?? null,
          createdAt: new Date(v.createdAt),
        })),
      },
    },
  });

  await prisma.case.update({ where: { id: caseId }, data: { updatedAt: new Date() } });
  return readCase(caseId);
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function addMessage(
  caseId: string,
  msg: Omit<Message, "id" | "createdAt" | "read">
): Promise<Message> {
  const row = await prisma.message.create({
    data: {
      caseId,
      senderId: msg.senderId,
      senderName: msg.senderName,
      senderRole: msg.senderRole as never,
      text: msg.text,
    },
  });
  await prisma.case.update({ where: { id: caseId }, data: { updatedAt: new Date() } });
  return {
    id: row.id,
    senderId: row.senderId,
    senderName: row.senderName,
    senderRole: row.senderRole as "admin" | "attorney" | "applicant",
    text: row.text,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function markMessagesRead(
  caseId: string,
  readerUserId: string
): Promise<void> {
  await prisma.message.updateMany({
    where: { caseId, read: false, senderId: { not: readerUserId } },
    data: { read: true },
  });
}

// ---------------------------------------------------------------------------
// Section comments
// ---------------------------------------------------------------------------

export async function addSectionComment(
  caseId: string,
  comment: Omit<SectionComment, "id" | "createdAt" | "resolved">
): Promise<SectionComment> {
  const row = await prisma.sectionComment.create({
    data: {
      caseId,
      sectionId: comment.sectionId,
      authorId: comment.authorId,
      authorName: comment.authorName,
      authorRole: comment.authorRole as never,
      text: comment.text,
    },
  });
  return {
    id: row.id,
    sectionId: row.sectionId,
    authorId: row.authorId,
    authorName: row.authorName,
    authorRole: row.authorRole as "admin" | "attorney" | "applicant",
    text: row.text,
    resolved: row.resolved,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function resolveSectionComment(caseId: string, commentId: string): Promise<void> {
  await prisma.sectionComment.updateMany({
    where: { id: commentId, caseId },
    data: { resolved: true },
  });
}

export async function deleteSectionComment(caseId: string, commentId: string): Promise<void> {
  await prisma.sectionComment.deleteMany({ where: { id: commentId, caseId } });
}

// ---------------------------------------------------------------------------
// Letter comments
// ---------------------------------------------------------------------------

export async function addLetterComment(
  caseId: string,
  letterId: string,
  comment: Omit<LetterComment, "id" | "createdAt" | "resolved">
): Promise<LetterComment> {
  // Verify letter belongs to case
  const letter = await prisma.letter.findFirst({ where: { id: letterId, caseId } });
  if (!letter) throw new Error("Letter not found");

  const row = await prisma.letterComment.create({
    data: {
      letterId,
      authorId: comment.authorId,
      authorName: comment.authorName,
      authorRole: comment.authorRole as never,
      text: comment.text,
    },
  });
  return {
    id: row.id,
    authorId: row.authorId,
    authorName: row.authorName,
    authorRole: row.authorRole as "admin" | "attorney" | "applicant",
    text: row.text,
    resolved: row.resolved,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function resolveLetterComment(
  caseId: string,
  letterId: string,
  commentId: string
): Promise<void> {
  await prisma.letterComment.updateMany({
    where: { id: commentId, letterId, letter: { caseId } },
    data: { resolved: true },
  });
}

export async function deleteLetterComment(
  caseId: string,
  letterId: string,
  commentId: string
): Promise<void> {
  await prisma.letterComment.deleteMany({
    where: { id: commentId, letterId, letter: { caseId } },
  });
}

// ---------------------------------------------------------------------------
// Attorney assignment & invites
// ---------------------------------------------------------------------------

export async function setAttorney(caseId: string, attorneyId: string): Promise<Case | null> {
  await revokeTokensFor("case_record", caseId, "case_invite");
  await prisma.case.update({
    where: { id: caseId },
    data: { attorneyId },
  });
  return readCase(caseId);
}

export async function createInvite(
  caseId: string,
  email: string
): Promise<{ token: string; expiry: string }> {
  await revokeTokensFor("case_record", caseId, "case_invite");
  const { plaintext, expiresAt } = await issueToken({
    kind: "case_invite",
    subjectType: "case_record",
    subjectId: caseId,
    ttlMs: TTL.CASE_INVITE,
    metadata: { email },
  });
  return { token: plaintext, expiry: expiresAt.toISOString() };
}

export async function findCaseByInviteToken(token: string): Promise<Case | null> {
  const verified = await verifyToken(token, "case_invite");
  if (!verified) return null;
  return readCase(verified.subjectId);
}

// ---------------------------------------------------------------------------
// Review request
// ---------------------------------------------------------------------------

export async function requestReview(caseId: string): Promise<Case | null> {
  await prisma.case.update({
    where: { id: caseId },
    data: { reviewStatus: "pending", reviewRequestedAt: new Date() },
  });
  return readCase(caseId);
}

export async function respondToReview(
  caseId: string,
  response: "accepted" | "declined",
  note?: string
): Promise<Case | null> {
  await prisma.case.update({
    where: { id: caseId },
    data: {
      reviewStatus: response,
      reviewRespondedAt: new Date(),
      reviewNote: note ?? null,
      ...(response === "accepted" ? { status: "review" } : {}),
    },
  });
  return readCase(caseId);
}

// ---------------------------------------------------------------------------
// Case top-level patches (status, title, etc.)
// ---------------------------------------------------------------------------

export async function patchCase(
  caseId: string,
  data: { title?: string; status?: Case["status"]; attorneyId?: string | null }
): Promise<Case | null> {
  await prisma.case.update({ where: { id: caseId }, data });
  return readCase(caseId);
}


// ---------------------------------------------------------------------------
// Letter review token (external recommender flow)
// ---------------------------------------------------------------------------

export async function createLetterReviewToken(
  letterId: string
): Promise<string> {
  await revokeTokensFor("letter", letterId, "letter_review");
  await prisma.letter.update({
    where: { id: letterId },
    data: { reviewerViewed: null, reviewerSubmitted: null },
  });
  const { plaintext } = await issueToken({
    kind: "letter_review",
    subjectType: "letter",
    subjectId: letterId,
    ttlMs: TTL.LETTER_REVIEW,
  });
  return plaintext;
}

export type ReviewLetterPayload = {
  letter: LetterRecord;
  caseTitle: string;
  applicantName: string;
  requirementTitle: string;
};

export async function getLetterByReviewToken(
  token: string
): Promise<ReviewLetterPayload | null> {
  const verified = await verifyToken(token, "letter_review");
  if (!verified) return null;

  const row = await prisma.letter.findUnique({
    where: { id: verified.subjectId },
    include: {
      versions: { orderBy: { createdAt: "asc" } },
      comments: { orderBy: { createdAt: "asc" } },
      case: { select: { title: true, formId: true, formData: true, id: true } },
    },
  });
  if (!row) return null;

  if (!row.reviewerViewed) {
    await prisma.letter.update({ where: { id: row.id }, data: { reviewerViewed: new Date() } });
  }

  const letter: LetterRecord = {
    id: row.id,
    requirementId: row.requirementId,
    recommender: row.recommender as LetterRecord["recommender"],
    selectedEvidence: row.selectedEvidence,
    currentDraft: row.currentDraft ?? undefined,
    qualityReport: (row.qualityReport ?? undefined) as QualityReport | undefined,
    versions: row.versions.map((v) => ({
      id: v.id,
      content: v.content,
      qualityReport: (v.qualityReport ?? undefined) as QualityReport | undefined,
      note: v.note ?? undefined,
      createdAt: v.createdAt.toISOString(),
    })),
    comments: row.comments.map((c) => ({
      id: c.id,
      authorId: c.authorId,
      authorName: c.authorName,
      authorRole: c.authorRole as "admin" | "attorney" | "applicant",
      text: c.text,
      resolved: c.resolved,
      createdAt: c.createdAt.toISOString(),
    })),
    reviewInviteSent: true,
    reviewerViewed: row.reviewerViewed?.toISOString() ?? undefined,
    reviewerSubmitted: row.reviewerSubmitted?.toISOString() ?? undefined,
    updatedAt: row.updatedAt.toISOString(),
  };

  const fd = row.case.formData as Record<string, unknown>;
  const pi = (fd["petitioner-info"] ?? fd["petitionerInfo"] ?? {}) as Record<string, unknown>;
  const applicantName = String(pi.fullName ?? "the applicant");

  return {
    letter,
    caseTitle: row.case.title,
    applicantName,
    requirementTitle: row.requirementId,
  };
}

export async function submitLetterReview(
  token: string,
  editedDraft: string
): Promise<boolean> {
  const verified = await verifyToken(token, "letter_review");
  if (!verified) return false;

  const versionId = newId();
  await prisma.letter.update({
    where: { id: verified.subjectId },
    data: {
      currentDraft: editedDraft,
      reviewerSubmitted: new Date(),
      versions: {
        create: {
          id: versionId,
          content: editedDraft,
          note: "Submitted by recommender",
          createdAt: new Date(),
        },
      },
    },
  });
  await consumeToken(verified.id);
  return true;
}

// ---------------------------------------------------------------------------
// Guest case access tokens
// ---------------------------------------------------------------------------

export async function createGuestToken(caseId: string): Promise<{ token: string; expiry: Date }> {
  await revokeTokensFor("case_record", caseId, "case_guest");
  const { plaintext, expiresAt } = await issueToken({
    kind: "case_guest",
    subjectType: "case_record",
    subjectId: caseId,
    ttlMs: TTL.CASE_GUEST,
  });
  return { token: plaintext, expiry: expiresAt };
}

export async function revokeGuestToken(caseId: string): Promise<void> {
  await revokeTokensFor("case_record", caseId, "case_guest");
}

export async function findCaseIdByGuestToken(token: string): Promise<string | null> {
  const verified = await verifyToken(token, "case_guest");
  if (!verified) return null;
  return verified.subjectId;
}

// ---------------------------------------------------------------------------
// Intake tokens
// ---------------------------------------------------------------------------

export async function createIntakeToken(
  caseId: string,
  email: string
): Promise<{ token: string; expiry: Date }> {
  await revokeTokensFor("case_record", caseId, "case_intake");
  const { plaintext, expiresAt } = await issueToken({
    kind: "case_intake",
    subjectType: "case_record",
    subjectId: caseId,
    ttlMs: TTL.CASE_INTAKE,
    metadata: { email },
  });
  return { token: plaintext, expiry: expiresAt };
}

export async function getCaseByIntakeToken(token: string): Promise<Case | null> {
  const verified = await verifyToken(token, "case_intake");
  if (!verified) return null;
  return readCase(verified.subjectId);
}

/**
 * Verify an intake token and return its metadata (email) without loading the case.
 * Used by the OTP flow — we need the email before granting access to case data.
 */
export async function verifyIntakeToken(
  token: string
): Promise<{ id: string; subjectId: string; email: string } | null> {
  const verified = await verifyToken(token, "case_intake");
  if (!verified) return null;
  const email = (verified.metadata as Record<string, unknown>)?.email;
  if (typeof email !== "string") return null;
  return { id: verified.id, subjectId: verified.subjectId, email };
}
