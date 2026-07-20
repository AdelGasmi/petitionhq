import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attorneyTermsAcceptedInDb } from "@/lib/attorneyTerms";
import { readCase } from "@/lib/db";
import { extractEvidence } from "@/lib/drafting";
import { computeLedgerRoot, type ClaimLedger } from "@/lib/claimLedger";
import { logActivity } from "@/lib/activity";
import { trackFunnel } from "@/lib/funnel";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/leads/[id]/claim-ledger — the attorney claim-curation gate writer.
 *
 * Body discriminated by `action`:
 *   { action: "open" }                       → emit gate.opened funnel beacon
 *   { action: "attest", approved: string[] } → persist + sign the claim ledger
 *
 * Access: admin OR the claiming attorney (BOLA). The attestation binds a named
 * attorney to the exact approved fact set the dossier may be built from.
 */
async function _POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "attorney")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The ledger attestation is a legal act — require current platform terms
  // for attorneys (layout gates the UI; this covers direct API calls).
  if (session.role === "attorney" && !(await attorneyTermsAcceptedInDb(session.userId))) {
    return NextResponse.json(
      { error: "Please accept the Attorney Platform Terms first.", code: "attorney_terms_required" },
      { status: 403 }
    );
  }

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, caseId: true, claimedByUserId: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // BOLA: only the claiming attorney (or an admin) may curate this lead.
  if (session.role !== "admin" && lead.claimedByUserId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!lead.caseId) {
    return NextResponse.json(
      { error: "No case to curate — intake has not started." },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => null)) as
    | { action?: string; approved?: unknown }
    | null;
  const action = body?.action;

  // Lightweight funnel beacon — attorney opened the gate (willingness signal).
  if (action === "open") {
    trackFunnel({
      event: "gate.opened",
      leadId: id,
      userId: session.userId,
      props: { caseId: lead.caseId },
    });
    return NextResponse.json({ ok: true });
  }

  if (action !== "attest") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const c = await readCase(lead.caseId);
  if (!c) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  // Server-authoritative atom set: approve only IDs that match a LIVE atom.
  // Stale/content-changed IDs are dropped (the interceptor would exclude them
  // anyway — keeping the ledger honest about what actually exists).
  const liveAtoms = extractEvidence(c.formData ?? {});
  const liveIds = new Set(liveAtoms.map((a) => a.id));
  const reqApproved = Array.isArray(body?.approved) ? body!.approved : [];
  const approved = [
    ...new Set(
      reqApproved.filter(
        (x): x is string => typeof x === "string" && liveIds.has(x),
      ),
    ),
  ];
  const approvedSet = new Set(approved);
  // Excluded = the strict complement over live atoms (audit trail; the filter
  // is approved-only, so excluded is derived, never trusted from the client).
  const excludedAtoms = liveAtoms.filter((a) => !approvedSet.has(a.id));
  const excluded = excludedAtoms.map((a) => a.id);

  const ledgerRoot = computeLedgerRoot(approved);
  const ledger: ClaimLedger = {
    approved,
    excluded,
    attestedBy: session.userId,
    attestedAt: new Date().toISOString(),
    ledgerRoot,
  };

  await prisma.case.update({
    where: { id: lead.caseId },
    data: { claimLedger: ledger as unknown as Prisma.InputJsonValue },
  });

  // Bust any cached dossier PDF. A PDF rendered before this attestation was
  // built from the un-curated formData and would leak excluded claims (inflated
  // citation totals, leaked venues) on the next download. Clearing
  // dossierPdfPath forces the GET dossier route to regenerate on-demand through
  // the interceptor with the freshly signed ledger. dossierStatus is left
  // untouched so the download button's visibility is unaffected.
  await prisma.lead
    .update({ where: { id }, data: { dossierPdfPath: null } })
    .catch(() => {});

  // Immutable attestation record (detail is a String column — stringify).
  await logActivity({
    actor: session,
    caseId: lead.caseId,
    caseTitle: c.title,
    action: "claim_ledger_attested",
    detail: `ledger ${ledgerRoot} — ${approved.length} approved / ${excluded.length} excluded`,
  });

  // Willingness-to-curate measurement. Per-atom toggles are intentionally NOT
  // beaconed (no per-keystroke spam); the curation breakdown lives here instead.
  trackFunnel({
    event: "gate.attested",
    leadId: id,
    userId: session.userId,
    props: {
      caseId: lead.caseId,
      ledgerRoot,
      approvedCount: approved.length,
      excludedCount: excluded.length,
      excludedKinds: excludedAtoms.map((a) => a.kind),
    },
  });

  return NextResponse.json({
    ok: true,
    ledgerRoot,
    approvedCount: approved.length,
    excludedCount: excluded.length,
  });
}

export const POST = withRoute(_POST);
