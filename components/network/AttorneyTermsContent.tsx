import { ATTORNEY_TERMS_VERSION } from "@/lib/attorneyTerms";

/**
 * Attorney Platform Terms — canonical content, rendered on the public
 * /attorney-terms page AND inside the acceptance gate (AttorneyTermsGate).
 * One source so the accepted text and the published text can never diverge.
 *
 * Version bumps: update ATTORNEY_TERMS_VERSION in lib/attorneyTerms.ts in the
 * same PR that edits this file — the gate forces re-acceptance automatically.
 */

function S({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-serif text-lg font-bold tracking-tight text-text-primary">
        {n}. {title}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed text-text-secondary">{children}</div>
    </section>
  );
}

export function AttorneyTermsContent() {
  return (
    <div className="space-y-6">
      <p className="text-xs text-text-muted">
        Version {ATTORNEY_TERMS_VERSION}. These Attorney Platform Terms (&ldquo;Terms&rdquo;)
        supplement the general PetitionHQ Terms of Service and govern use of the platform by
        licensed attorneys and their firms (&ldquo;Attorney,&rdquo; &ldquo;you&rdquo;).
        Where these Terms conflict with the general Terms of Service, these Terms control for
        attorney accounts.
      </p>

      <S n={1} title="What PetitionHQ is — and is not">
        <p>
          PetitionHQ (&ldquo;we,&rdquo; &ldquo;the Platform&rdquo;) provides software and data
          services: candidate screening and public-record corroboration, case-management and
          document-drafting tools, and introductions to consenting prospective clients.
          <strong className="text-text-primary"> We are not a law firm, we do not practice law,
          and we provide no legal services or legal advice to anyone.</strong> You are the sole
          provider of legal services to any client you engage. Nothing in these Terms creates a
          partnership, joint venture, employment, or agency relationship between you and PetitionHQ.
        </p>
      </S>

      <S n={2} title="Eligibility and account">
        <p>
          You represent that you are (or your account is operated under the supervision of) an
          attorney in good standing admitted to practice in at least one U.S. jurisdiction, and
          that you will notify us promptly if that ceases to be true. You are responsible for
          activity under your account and for safeguarding credentials. Accounts are per-firm-seat
          and may not be shared outside your firm.
        </p>
      </S>

      <S n={3} title="Lead introductions are marketing, not referrals">
        <p>
          Candidate introductions (&ldquo;leads&rdquo;) are a flat-fee advertising/marketing
          service. Fees are fixed, are charged per introduction regardless of outcome, and are
          <strong className="text-text-primary"> never contingent on engagement, fees you earn, or
          case results</strong>. We do not split, share in, or take a percentage of your legal
          fees, and we do not recommend or vouch for any particular attorney to candidates beyond
          factual specialty matching. You are responsible for confirming that your participation
          complies with the advertising, solicitation, and referral rules of your jurisdiction(s).
        </p>
      </S>

      <S n={4} title="Lead claims, fees, and refunds">
        <p>
          Claiming a lead is exclusive: a claimed lead is not offered to other firms while your
          claim is active. Current pricing is stated at checkout (currently a flat fee of $150 per
          claimed lead; optional subscription seats are billed as stated at purchase). Refunds:
          (a) if a claimed candidate is unresponsive for 14 days despite reasonable contact
          attempts, the claim fee is automatically refunded; (b) if you identify a material
          misrepresentation in a candidate&rsquo;s corroborated profile within 30 days of claiming,
          you may request a refund for our review; (c) approved refunds are returned to the
          original payment method, typically within 5&ndash;10 business days. Pilot (free) claims
          carry no fee and are non-refundable.
        </p>
      </S>

      <S n={5} title="Verification means corroboration — not identity proof">
        <p>
          Our screening cross-checks a candidate&rsquo;s self-reported claims against public
          records (e.g., OpenAlex, ORCID, Crossref, ROR, NSF, NIH, USPTO, and similar sources) and
          reports a corroboration level. Unless a profile is explicitly labeled
          &ldquo;Identity confirmed (ORCID),&rdquo;
          <strong className="text-text-primary"> corroboration establishes that a real person with
          the reported record exists and that the claims are consistent with public records — not
          that the individual contacting you is that person.</strong> You remain responsible for
          your own client-identity, conflicts, and due-diligence procedures before entering an
          engagement or filing anything. Verification reports are provided &ldquo;as is&rdquo; from
          third-party public data that may be incomplete or out of date.
        </p>
      </S>

      <S n={6} title="Your professional responsibility">
        <p>
          You retain sole and independent professional judgment and responsibility for all legal
          work, including case selection, strategy, the decision to file, and everything you sign
          or submit to any government agency. You are responsible for compliance with all rules of
          professional conduct applicable to you, including competence, confidentiality,
          communication, advertising/solicitation, and supervision of nonlawyer assistance
          (which includes this software).
        </p>
      </S>

      <S n={7} title="AI-assisted drafting">
        <p>
          The Platform generates draft documents (recommendation letters, petition-brief sections,
          assessments) using large language models constrained by your case data and, where
          configured, your firm&rsquo;s drafting rules. Drafts are
          <strong className="text-text-primary"> starting points for attorney review, not finished
          legal work</strong>. You must independently verify every factual assertion, citation,
          and legal argument before use. The drafting tools flag unverified numeric claims, but no
          automated check replaces attorney review. You are responsible for any disclosure of
          AI assistance required by a court, agency, or your jurisdiction.
        </p>
      </S>

      <S n={8} title="Candidate data, confidentiality, and privilege">
        <p>
          Candidate and client data you access through the Platform (including pre-claim
          anonymized profiles and post-claim contact details and intake data) may be used only to
          evaluate and provide legal services to that individual. You may not resell, publish, or
          use such data for unrelated marketing. Attorney-client privilege and the client
          relationship are yours alone; PetitionHQ administrators are technically firewalled from
          case content and we make no claim to privileged material. Each party will protect the
          other&rsquo;s confidential information with reasonable care. Our processing of personal
          data is described in the Privacy Policy; you are independently responsible for your own
          obligations to your clients regarding their data.
        </p>
      </S>

      <S n={9} title="Work product and white-label exports">
        <p>
          Documents you finalize and export for filing (briefs, letters) are your work product and
          carry no PetitionHQ branding. You own your work product. We own the Platform, including
          software, scoring and verification methodology, templates, and aggregated, de-identified
          usage data. You receive a limited, non-exclusive, non-transferable license to use the
          Platform for your practice during your subscription or pilot.
        </p>
      </S>

      <S n={10} title="Acceptable use">
        <p>
          You will not: misrepresent your identity or licensure; attempt to contact candidates you
          have not claimed; scrape, reverse-engineer, or benchmark the Platform for a competing
          service; upload malicious code; or use the Platform to violate any law or professional
          rule. We may suspend accounts that endanger candidates, other users, or the Platform.
        </p>
      </S>

      <S n={11} title="Disclaimers">
        <p>
          THE PLATFORM, ALL SCORES, ASSESSMENTS, VERIFICATION REPORTS, AND DRAFTS ARE PROVIDED
          &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTIES OF ANY KIND,
          EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
          NON-INFRINGEMENT. WE DO NOT WARRANT THAT ANY CANDIDATE WILL ENGAGE YOU, THAT ANY
          PETITION WILL SUCCEED, OR THAT DATA FROM THIRD-PARTY PUBLIC SOURCES IS ACCURATE OR
          COMPLETE.
        </p>
      </S>

      <S n={12} title="Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEITHER PARTY IS LIABLE FOR INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOST PROFITS OR REVENUES.
          PETITIONHQ&rsquo;S TOTAL AGGREGATE LIABILITY ARISING OUT OF THESE TERMS IS LIMITED TO
          THE AMOUNTS YOU PAID TO PETITIONHQ IN THE TWELVE (12) MONTHS BEFORE THE EVENT GIVING
          RISE TO THE CLAIM. NOTHING IN THESE TERMS LIMITS LIABILITY FOR FRAUD OR WILLFUL
          MISCONDUCT.
        </p>
      </S>

      <S n={13} title="Indemnification">
        <p>
          You will defend and indemnify PetitionHQ against third-party claims arising from your
          provision of legal services, your engagement decisions, anything you file, or your
          breach of these Terms. PetitionHQ will defend and indemnify you against third-party
          claims that the Platform software itself, as provided by us and used as directed,
          infringes a U.S. intellectual-property right.
        </p>
      </S>

      <S n={14} title="Term, termination, and data">
        <p>
          Either party may terminate at any time; subscription fees already paid are
          non-refundable except as stated in Section 4. On termination we will, on request,
          provide an export of your case data in a portable format within 30 days, after which we
          may delete it per our retention policy. Sections 5&ndash;9 and 11&ndash;16 survive
          termination.
        </p>
      </S>

      <S n={15} title="Changes to these Terms">
        <p>
          We may update these Terms by posting a new version and bumping the version identifier.
          Material changes require your re-acceptance before continued use of attorney surfaces.
          Continued use after re-acceptance constitutes agreement to the updated Terms.
        </p>
      </S>

      <S n={16} title="Governing law and disputes">
        <p>
          These Terms are governed by the laws of the State of Texas, without regard to
          conflict-of-law rules. The parties will first attempt in good faith to resolve any
          dispute informally within 30 days of written notice; thereafter, exclusive venue lies in
          the state or federal courts located in Texas, and each party consents to their
          jurisdiction. If any provision is unenforceable, the remainder stays in effect; our
          failure to enforce a provision is not a waiver.
        </p>
      </S>
    </div>
  );
}
