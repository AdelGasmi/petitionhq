import Link from "next/link";
import type { JSX } from "react";

export type ArticleSource = { title: string; url: string };

export type ArticleMeta = {
  slug: string;
  title: string;
  dek: string;
  description: string;
  datePublished: string;
  dateModified: string;
  readMinutes: number;
  relatedSlugs: string[];
  faqs?: Array<{ q: string; a: string }>;
  /** 40–60 word direct answer to the target query — lifted by AI engines */
  tldr?: string;
  /** 3–5 scannable takeaway bullets */
  takeaways?: string[];
  /** Primary-source citations (USCIS Policy Manual, case law, etc.) */
  sources?: ArticleSource[];
  /** Table of contents for articles ≥ 6 min */
  tableOfContents?: Array<{ heading: string; anchor: string }>;
  /** Journey-stage pillar for the articles index grouping */
  pillar?: "eligibility" | "evidence-building" | "filing-timeline" | "rfe-denial";
};

export type Article = {
  meta: ArticleMeta;
  Body: () => JSX.Element;
};

// ── A1 ── EB-2 NIW RFE Response ─────────────────────────────────────────────

const rfeResponseMeta: ArticleMeta = {
  slug: "eb2-niw-rfe-response",
  title: "EB-2 NIW RFE: What It Means and How to Respond (2026)",
  dek: "Roughly 1 in 2 NIW petitions now draw an RFE. Here's what the 87-day clock means, which prongs get challenged most, and how to respond without wasting your one shot.",
  description: "A USCIS Request for Evidence is not a denial — but your 87-day response determines your case. Learn the most-challenged NIW prongs and what a strong RFE response looks like.",
  datePublished: "2026-06-11",
  dateModified: "2026-06-11",
  readMinutes: 8,
  relatedSlugs: ["eb2-niw-denial-reasons"],
  faqs: [
    {
      q: "Can I request more time to respond to an NIW RFE?",
      a: "No. USCIS does not grant extensions for RFE responses. The 87-day deadline is firm and runs from the date on the RFE notice, not the date you receive it.",
    },
    {
      q: "Can USCIS deny my petition without issuing an RFE?",
      a: "Yes. USCIS can deny a petition outright if the record is clearly insufficient without requesting additional evidence. An RFE is not guaranteed.",
    },
    {
      q: "Can I add new evidence in my RFE response?",
      a: "Yes — and you should. RFE responses are not limited to addressing the stated concerns; you may also submit new evidence that strengthens the overall record.",
    },
    {
      q: "What is the approval rate after responding to an NIW RFE?",
      a: "USCIS does not publish post-RFE approval rates by category. Based on practitioner data, a well-prepared RFE response addressing the specific deficiencies achieves approval in the majority of cases — but a weak or off-point response rarely overcomes the initial challenge.",
    },
  ],
  tldr: "An NIW RFE is not a denial — it's a request for clarification with an 87-day clock starting from the RFE date, not receipt. Prong 2 is the most commonly challenged prong. Your response can include new evidence beyond the stated deficiencies. A targeted, evidence-rich reply achieves approval in the majority of well-prepared cases.",
  takeaways: [
    "The 87-day deadline runs from the RFE date, not the date you receive it — treat it as a firm deadline",
    "Prong 2 ('well-positioned to advance') is the most commonly challenged prong in NIW RFEs",
    "Your response can include new evidence; you are not limited to addressing only stated deficiencies",
    "USCIS can deny without issuing an RFE if the record is clearly insufficient",
    "Attorney representation significantly improves RFE response success rates",
  ],
  sources: [
    { title: "USCIS Policy Manual — EB-2 NIW (Vol. 6, Part F)", url: "https://www.uscis.gov/policy-manual/volume-6-part-f" },
    { title: "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)", url: "https://www.uscis.gov/sites/default/files/err/B5%20-%20Researchers%20and%20Developers/Decisions_Issued_in_2016/JAN192016_01B5203.pdf" },
  ],
  tableOfContents: [
    { heading: "The 87-day clock", anchor: "the-87-day-clock" },
    { heading: "Why the RFE rate surged", anchor: "why-the-rfe-rate-surged" },
    { heading: "Which prongs USCIS challenges most", anchor: "which-prongs-uscis-challenges-most" },
    { heading: "How to structure your response", anchor: "how-to-structure-your-response" },
    { heading: "Common response mistakes", anchor: "common-response-mistakes" },
  ],
  pillar: "rfe-denial",
};

function RfeResponseBody(): JSX.Element {
  return (
    <div className="prose">
      <p>
        Roughly half of all EB-2 NIW petitions now receive a Request for Evidence (RFE) before
        USCIS decides the case. That statistic has roughly doubled in three years, and it means
        the RFE is no longer an edge case — it is close to the expected experience.
      </p>
      <p>
        An RFE is not a denial. It is USCIS asking for additional documentation or clarification
        before making a decision. But the response window is narrow, the format matters, and a
        weak or off-point response usually produces the denial the RFE was warning about.
      </p>

      <h2>The 87-day clock</h2>
      <p>
        When USCIS issues an RFE, you have <strong>87 calendar days from the date on the
        notice</strong> — not the date you receive it — to submit a complete response. Mail
        delays are your problem. If you miss the deadline, USCIS adjudicates on the original
        record, which typically means denial.
      </p>
      <p>
        There are no extensions. There is no appeal of a missed deadline at the USCIS level.
        If your deadline passes, your path forward is a new petition.
      </p>
      <p>
        The practical advice: treat 60 days as your real deadline. The last two weeks are
        for your attorney to review the response package, assemble exhibits, and submit
        with delivery confirmation.
      </p>

      <h2>Why the RFE rate surged</h2>
      <p>
        The RFE rate for NIW petitions has approximately doubled since FY2022. Two factors
        drive the increase:
      </p>
      <ul>
        <li>
          <strong>Higher adjudicator scrutiny:</strong> USCIS has staffed NIW adjudication
          with officers who apply the <em>Matter of Dhanasar</em> three-prong test more
          granularly than the previous generation of approvals. Cases that cleared
          prong-level review in 2021 are now getting challenged on specifics.
        </li>
        <li>
          <strong>More self-prepared petitions:</strong> The rise of DIY filings — using
          document-preparation software or no professional help — brought a wave of
          technically complete but substantively thin petitions. Thin records produce RFEs.
        </li>
      </ul>

      <h2>The most-challenged prongs</h2>

      <h3>Prong 1 — Substantial merit and national importance</h3>
      <p>
        The most common first-prong RFE target is the <em>proposed endeavor</em>. Vague
        descriptions ("AI research," "pharmaceutical development," "climate technology")
        draw challenges. USCIS increasingly expects:
      </p>
      <ul>
        <li>A specific proposed endeavor — named application, field, or problem</li>
        <li>Documentation that the field is a recognized national priority (NSTC critical
        technologies list, NIH/NSF/DOE priority programs, congressional mandates)</li>
        <li>Evidence that <em>your specific</em> work — not just the field generally —
        has substantial merit</li>
      </ul>

      <h3>Prong 2 — Well-positioned to advance the endeavor</h3>
      <p>
        Citation count alone is the most-challenged evidence type for prong 2. USCIS
        adjudicators now routinely request:
      </p>
      <ul>
        <li>Field-normalized context (not raw counts)</li>
        <li>Evidence of deployment or adoption beyond academic citation</li>
        <li>U.S. institutional interest — letters from universities, labs, or companies
        that specifically want your work applied</li>
      </ul>
      <p>
        The prong-2 RFE often reads: "The petitioner has not established that they are
        well-positioned to advance their stated endeavor beyond demonstrating general
        expertise." Respond with specificity.
      </p>

      <h3>Prong 3 — On balance beneficial to waive the job requirement</h3>
      <p>
        This prong is where self-interest arguments fail. An RFE on prong 3 almost always
        contains language asking why <em>the national interest specifically requires the
        waiver</em> — not just why the applicant wants to stay. Responses need to argue
        why the labor market test would harm U.S. interests in this specific case: urgency,
        uniqueness, or documented U.S. employer/institutional need.
      </p>

      <h2>Anatomy of a strong RFE response</h2>
      <p>
        A well-constructed RFE response has three layers that work together:
      </p>

      <h3>1. Direct rebuttal, point by point</h3>
      <p>
        Each concern USCIS raised deserves a numbered, specific response with exhibit
        citations. If the RFE questions citation impact, respond with a citation-analysis
        letter from a qualified expert placing your record in field context — not a
        restatement of what the original petition already said.
      </p>

      <h3>2. Amplified evidence</h3>
      <p>
        USCIS already read your original filing and found it insufficient. Do not simply
        resubmit with minor additions. The RFE response is an opportunity to enter new
        evidence: independent recommendation letters from experts who weren't in the original
        petition, post-filing publications, adoption or deployment documentation, and
        institutional-interest letters from U.S. entities that have used or want to use
        your work.
      </p>

      <h3>3. Legal argument</h3>
      <p>
        For each challenged prong, include a brief legal argument citing AAO precedent
        decisions and recent USCIS policy guidance. The goal is to make the adjudicator's
        approval decision defensible on the record — not just persuasive to a human reader.
        This is the layer that typically requires experienced NIW counsel.
      </p>

      <h2>Common RFE response mistakes</h2>
      <ul>
        <li>
          <strong>Restating what was already filed:</strong> USCIS already read it. If they
          challenged it, repeating it doesn't resolve the challenge.
        </li>
        <li>
          <strong>Generic letters from the same recommenders:</strong> Resubmitting revised
          versions of the same five letters raises more questions about the quality of your
          independent support network.
        </li>
        <li>
          <strong>Addressing the wrong prong:</strong> If the RFE specifically challenges
          prong 2, a response focused on prong 1 and 3 improvements misses the point.
          Read the RFE language precisely and respond to what was actually challenged.
        </li>
        <li>
          <strong>Waiting too long to start:</strong> RFE responses require gathering new
          evidence, writing legal briefs, and coordinating with recommenders — none of which
          happens quickly. Starting your response on day 60 leaves you no time to fix problems.
        </li>
      </ul>

      <div className="not-prose my-8 rounded-xl bg-surface-subtle border border-border-default px-6 py-5">
        <p className="text-sm font-semibold text-text-primary mb-2">Know where your case actually stands before your next step</p>
        <p className="text-sm text-text-secondary mb-4">
          Our free 5-minute assessment scores your record against the same Dhanasar prongs
          USCIS uses — including the specific evidence types that draw the most RFEs. Honest result,
          including the gaps USCIS would flag.
        </p>
        <Link href="/check" className="btn btn-primary text-sm">
          Check my NIW case strength — free
        </Link>
      </div>

      <h2>When to involve an attorney (if you haven't already)</h2>
      <p>
        If you filed without an attorney and received an RFE, this is the moment to
        reconsider. The RFE response is arguably more consequential than the original
        petition: USCIS is now specifically scrutinizing your case and has identified
        where the record is weak.
      </p>
      <p>
        A qualified NIW attorney (not general immigration counsel) can:
      </p>
      <ul>
        <li>Identify which parts of the RFE are standardized challenges versus case-specific concerns</li>
        <li>Draft the legal brief component of the response</li>
        <li>Coordinate new independent recommendation letters with appropriate framing</li>
        <li>Structure the exhibit package so the adjudicator can verify each point efficiently</li>
      </ul>
      <p>
        The cost of an RFE response with experienced NIW counsel is substantially less than
        the cost of a re-filing after denial — plus the lost time.
      </p>

      <p>
        Related: <Link href="/articles/eb2-niw-denial-reasons">Why EB-2 NIW petitions get
        denied</Link> and the{" "}
        <Link href="/eb2-niw-guide">EB-2 NIW filing guide</Link>.
      </p>

      <p className="text-xs text-text-muted mt-8">
        Not legal advice. PetitionHQ is document-preparation software. If you have received
        an RFE, consult a qualified U.S. immigration attorney before responding.
      </p>
    </div>
  );
}

// ── A2 ── EB-2 NIW Denial Reasons ────────────────────────────────────────────

const denialReasonsMeta: ArticleMeta = {
  slug: "eb2-niw-denial-reasons",
  title: "Why EB-2 NIW Petitions Get Denied: The 7 Real Reasons (2026 data)",
  dek: "With approval rates at historic lows, understanding exactly why USCIS denies NIW petitions could save you $15,000 and years of waiting.",
  description: "EB-2 NIW approval rates fell from ~80% to ~36% by late FY2025. This breakdown of the 7 real denial reasons explains what changed and what strong petitions do differently.",
  datePublished: "2026-06-11",
  dateModified: "2026-06-11",
  readMinutes: 9,
  relatedSlugs: ["eb2-niw-rfe-response"],
  faqs: [
    {
      q: "Can I refile an EB-2 NIW petition after a denial?",
      a: "Yes. A denial does not bar you from filing a new petition, provided you address the grounds for denial and meet the eligibility requirements. There is no mandatory waiting period.",
    },
    {
      q: "Does a prior NIW denial hurt my new petition?",
      a: "Not directly — each petition is adjudicated on its own merits. However, if the same deficiencies that caused the first denial appear in the new petition, a second denial is likely. USCIS does not penalize prior filings, but it does apply the same standards.",
    },
    {
      q: "Can I appeal an EB-2 NIW denial?",
      a: "Yes. You can file a Motion to Reopen (new evidence) or Motion to Reconsider (legal error) with USCIS, or appeal to the Administrative Appeals Office (AAO). Appeals take 12–24 months. Most practitioners recommend a new filing with a strengthened record rather than appealing a substantively weak petition.",
    },
    {
      q: "Is the NIW denial rate really 37% now?",
      a: "USCIS publishes quarterly adjudication data. The denial rate for I-140 EB-2 NIW petitions crossed 50% of adjudications in some FY2025 quarters. The ~36–37% approval rate cited reflects the full FY2025 projected year. Rates vary by quarter and USCIS service center.",
    },
  ],
  tldr: "EB-2 NIW petitions are denied most often for three reasons: a vague proposed-endeavor statement, failure to demonstrate you are 'well-positioned' to advance your field (Prong 2), and recommendation letters that describe past work without addressing future contribution. Filing before sufficient evidence accumulates is the most common tactical mistake.",
  takeaways: [
    "Generic endeavor statements that copy USCIS language are among the top denial triggers",
    "Prong 2 requires evidence of track record — 'should advance' language fails; 'has advanced' succeeds",
    "Letters describing past work but not future contribution add minimal weight to the petition",
    "Filing too early — before a critical mass of post-degree evidence accumulates — magnifies all other risks",
    "Unaddressed inconsistencies between petition and supporting letters compound denial risk significantly",
  ],
  sources: [
    { title: "USCIS Forms Data — I-140 Approval/Denial Statistics", url: "https://www.uscis.gov/tools/reports-and-studies/immigration-forms-data" },
    { title: "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)", url: "https://www.uscis.gov/sites/default/files/err/B5%20-%20Researchers%20and%20Developers/Decisions_Issued_in_2016/JAN192016_01B5203.pdf" },
  ],
  tableOfContents: [
    { heading: "The approval rate shift: FY2023–FY2025", anchor: "the-approval-rate-shift-fy2023fy2025" },
    { heading: "The 7 real denial reasons", anchor: "the-7-real-denial-reasons" },
    { heading: "What changed in USCIS adjudication", anchor: "what-changed-in-uscis-adjudication" },
    { heading: "What strong petitions do differently", anchor: "what-strong-petitions-do-differently" },
  ],
  pillar: "rfe-denial",
};

function DenialReasonsBody(): JSX.Element {
  return (
    <div className="prose">
      <p>
        The EB-2 National Interest Waiver used to be one of the more forgiving employment-based
        categories. Approval rates consistently ran above 75% through 2022. Between FY2023 and
        late FY2025, that rate collapsed to approximately 36% — the first time on record that
        USCIS denied more NIW petitions than it approved.
      </p>
      <p>
        The bar moved. Most applicants filing today with credentials that would have cleared
        five years ago are facing a fundamentally different adjudication environment. The seven
        patterns below account for the overwhelming majority of denials in this new era.
      </p>

      <h2>The approval rate shift: FY2023–FY2025</h2>

      <div className="not-prose my-6 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left py-2 pr-4 font-semibold text-text-primary">Fiscal Year</th>
              <th className="text-right py-2 pr-4 font-semibold text-text-primary">Approvals</th>
              <th className="text-right py-2 pr-4 font-semibold text-text-primary">Denials</th>
              <th className="text-right py-2 font-semibold text-text-primary">Approval Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border-subtle">
              <td className="py-2 pr-4 text-text-secondary">FY2023</td>
              <td className="py-2 pr-4 text-right text-text-secondary">~4,200</td>
              <td className="py-2 pr-4 text-right text-text-secondary">~1,100</td>
              <td className="py-2 text-right font-semibold text-success-text">~79%</td>
            </tr>
            <tr className="border-b border-border-subtle">
              <td className="py-2 pr-4 text-text-secondary">FY2024</td>
              <td className="py-2 pr-4 text-right text-text-secondary">~3,600</td>
              <td className="py-2 pr-4 text-right text-text-secondary">~2,500</td>
              <td className="py-2 text-right font-semibold text-warning-text">~59%</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 text-text-secondary">FY2025 (proj.)</td>
              <td className="py-2 pr-4 text-right text-text-secondary">~2,100</td>
              <td className="py-2 pr-4 text-right text-text-secondary">~3,600</td>
              <td className="py-2 text-right font-semibold text-danger-text">~37%</td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-text-muted mt-2">Source: USCIS I-140 adjudication data, FY2023–2025. Projections based on Q1–Q3 FY2025 data.</p>
      </div>

      <h2>The 7 real denial reasons</h2>

      <h3>1. Vague proposed endeavor</h3>
      <p>
        This is the most common prong-1 failure, and it is entirely preventable. Descriptions
        like "conducting AI research in the United States," "pharmaceutical development," or
        "climate technology innovation" are routinely challenged because they describe a field,
        not an endeavor.
      </p>
      <p>
        USCIS expects a specific, named endeavor tied to a documented national priority:
        a particular medical application, a specific technology deployment gap, a named federal
        program the work advances. The NSTC critical technologies list, NIH priority areas,
        CHIPS Act priorities, and DOE program objectives all serve as anchoring documents.
      </p>

      <h3>2. Citation context without field normalization</h3>
      <p>
        "I have 847 citations" is not evidence. 847 citations in computational biology, where
        leading researchers have 100,000+, means something entirely different than 847 citations
        in geotechnical engineering. USCIS adjudicators have become increasingly sophisticated
        about this, and petitions that present raw citation counts without field-normalized
        context are now routinely challenged under prong 2.
      </p>
      <p>
        Strong petitions include a citation-analysis letter from a qualified expert who places
        the applicant's record in field context — percentile ranking, h-index comparison,
        citation velocity — not just the raw numbers.
      </p>

      <h3>3. Dependent recommenders only</h3>
      <p>
        If the majority of your recommendation letters come from people who have a direct
        professional relationship with you — PhD supervisor, former colleagues, collaborators,
        co-authors — USCIS discounts them heavily. The standard from <em>Matter of Dhanasar</em>{" "}
        and subsequent AAO decisions expects a substantial portion of letters from independent
        experts: researchers who know your work from the literature, not from personal interaction.
      </p>
      <p>
        A useful benchmark: aim for at least 60% of letters from truly independent experts —
        people you have never co-authored with, never worked for or supervised by, never met in a
        professional capacity. This is harder to arrange but carries significantly more weight.
      </p>

      <h3>4. Prong-3 self-interest framing</h3>
      <p>
        "I want to continue my research in the U.S." is not a prong-3 argument. Prong 3 asks
        specifically why it is in the national interest to waive the labor market test — not why
        the applicant wants to stay. The labor market test exists to protect U.S. workers. Your
        petition needs to argue why that protection should be bypassed in this specific case.
      </p>
      <p>
        Successful prong-3 arguments focus on: urgency (the work is time-sensitive and cannot
        wait for a PERM process), uniqueness (no qualified U.S. worker is available or in the
        pipeline for this specific role), or documented institutional need (specific U.S. labs,
        companies, or agencies have stated they need this applicant's specific skills).
      </p>

      <h3>5. No evidence of being well-positioned beyond credentials</h3>
      <p>
        A PhD from a top-10 program and publications in strong journals prove you are qualified.
        They do not prove you are "well-positioned to advance the endeavor." Prong 2 requires
        evidence that you specifically are ready to execute the proposed work — not just that
        you are generally excellent at a field.
      </p>
      <p>
        Well-positioned evidence includes: letters from U.S. institutions that want your specific
        expertise applied to their programs, documented adoption of your prior work by U.S.
        entities, grants or funding you have already secured for the proposed work, deployment
        or commercialization of prior research.
      </p>

      <h3>6. Filing before the record is ready</h3>
      <p>
        This is the most consequential preventable mistake in the current adjudication environment.
        In a 79% approval landscape, filing with a thin record made financial and strategic sense.
        The expected value calculation was: low odds of denial, fast approval if accepted.
      </p>
      <p>
        In a 37% approval landscape, that calculation is inverted. Filing a borderline petition now
        costs $700+ in fees, potentially $6–15K in attorney fees, a year of processing time,
        and the risk of a denial that may complicate future filings. Waiting three to six months
        to strengthen a record — more independent letters, a stronger proposed-endeavor statement,
        a field-normalized citation analysis — often produces a fundamentally different outcome.
      </p>

      <h3>7. Credential mismatch: strong on paper, weak on prongs</h3>
      <p>
        Stellar academic credentials don't automatically translate to NIW approval. USCIS
        adjudicates against three specific prongs, not general impressiveness. An applicant with
        four papers and a specific, well-documented proposed endeavor tied to a named federal
        priority frequently outperforms an applicant with 50 papers and no coherent endeavor
        statement.
      </p>
      <p>
        This surprises many applicants. It shouldn't. The NIW waiver is specifically about
        advancing a national-interest endeavor — not recognizing general excellence. A highly
        cited researcher with no clear U.S. application for their work often loses to a
        mid-career practitioner with clear documentation of what they plan to do and why the
        U.S. needs them to do it.
      </p>

      <h2>"File later" as a deliberate strategy</h2>
      <p>
        Given the approval rate shift, "not yet" is now a legitimate strategic position — not
        a defeat. The specific actions that move applicants from borderline to approvable are
        well-defined:
      </p>
      <ul>
        <li>Cultivate three to five truly independent recommenders</li>
        <li>Document your proposed endeavor with specificity and federal-priority anchoring</li>
        <li>Gather evidence of U.S. institutional interest in your specific work</li>
        <li>Commission a field-normalized citation analysis from a qualified expert</li>
      </ul>
      <p>
        None of these requires additional publications or another degree. They require evidence
        collection and documentation. A six-month investment in getting the record right changes
        the expected outcome dramatically in the current environment.
      </p>

      <div className="not-prose my-8 rounded-xl bg-surface-subtle border border-border-default px-6 py-5">
        <p className="text-sm font-semibold text-text-primary mb-2">Find out where your case actually stands before you file</p>
        <p className="text-sm text-text-secondary mb-4">
          Our free 5-minute assessment scores your record against the same Dhanasar prongs
          that caused the FY2025 denial surge — with honest tier output, including "not yet ready."
          Know the gaps before they become a denial.
        </p>
        <Link href="/check" className="btn btn-primary text-sm">
          Check my NIW odds — free
        </Link>
      </div>

      <p>
        If you have already received an RFE, see{" "}
        <Link href="/articles/eb2-niw-rfe-response">how to respond to an NIW RFE</Link>.
        For the underlying framework, the{" "}
        <Link href="/eb2-niw-guide">EB-2 NIW guide</Link> covers each Dhanasar prong in detail.
      </p>

      <p className="text-xs text-text-muted mt-8">
        Not legal advice. PetitionHQ is document-preparation software. Immigration law decisions
        should be made in consultation with a qualified U.S. immigration attorney.
      </p>
    </div>
  );
}

// ── A3 ── EB-2 NIW Without a PhD ─────────────────────────────────────────────

const noPhdMeta: ArticleMeta = {
  slug: "eb2-niw-without-phd",
  title: "EB-2 NIW Without a PhD: Engineer & Professional Paths",
  dek: "A PhD is not required for EB-2 NIW. Here's how engineers, software professionals, and practitioners qualify — and what evidence substitutes for academic citations.",
  description: "You can qualify for EB-2 NIW without a PhD using advanced-degree equivalency or exceptional ability routes. Learn what evidence engineers and non-academics need.",
  datePublished: "2026-06-11",
  dateModified: "2026-06-11",
  readMinutes: 8,
  relatedSlugs: ["niw-citations-how-many", "eb2-niw-denial-reasons"],
  faqs: [
    { q: "Can a software engineer get EB-2 NIW without a PhD?", a: "Yes. Software engineers with a bachelor's degree plus five years of progressive experience can qualify under the advanced-degree-equivalency path. The critical requirement is documenting the experience through official records — not just listing it on a resume." },
    { q: "Does a master's degree count for EB-2 NIW?", a: "Yes. A U.S. master's degree (or foreign equivalent) qualifies as an 'advanced degree' for EB-2 eligibility. You still need to meet the three Dhanasar prongs to qualify for the NIW waiver itself." },
    { q: "What counts as 'exceptional ability' for EB-2?", a: "USCIS uses a 6-criteria test (Matter of Price) — you must meet at least 3 of: official academic record showing degree in the field, 10+ years of full-time experience, professional license or certification, salary evidence showing exceptional compensation, membership in professional associations requiring outstanding achievement, recognition from peers or government entities. A PhD is not one of the criteria." },
    { q: "Is EB-2 NIW harder without a PhD?", a: "Not necessarily. USCIS adjudicates the three Dhanasar prongs on their merits regardless of degree type. However, non-PhD applicants often need to be more deliberate about documenting prong-2 evidence (well-positioned) since they can't rely on a dissertation or academic publication record as shorthand for expertise." },
  ],
  tldr: "You do not need a PhD for EB-2 NIW. A U.S. master's degree combined with five years of progressive experience qualifies under EB-2 Advanced Degree. Engineers and software professionals qualify regularly by substituting citation metrics with impact evidence: deployed systems, patents, industry awards, or policy influence.",
  takeaways: [
    "EB-2 requires a U.S. master's (or equivalent) plus 5 years' progressive experience, or evidence of exceptional ability",
    "Exceptional ability is established through 3 of 6 criteria — degree, high salary, license, recognition, etc. A PhD is not one of the criteria",
    "Non-academic work evidence — patents, deployed technology, industry awards — directly substitutes for citations",
    "Software professionals and engineers qualify regularly when their work demonstrates broad industry impact",
    "The three Dhanasar prongs apply identically regardless of whether you hold a PhD",
  ],
  sources: [
    { title: "USCIS Policy Manual — EB-2 Exceptional Ability (Vol. 6, Part F, Ch. 5)", url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-5" },
    { title: "INA § 203(b)(2) — Advanced Degree or Exceptional Ability", url: "https://www.govinfo.gov/content/pkg/USCODE-2021-title8/html/USCODE-2021-title8-chap12-subchapII-partII-sec1153.htm" },
  ],
  pillar: "eligibility",
};

function NoPhdBody(): JSX.Element {
  return (
    <div className="prose">
      <p>
        EB-2 NIW petitions are filed by researchers. That's the association most people have,
        because academia supplies a large portion of the NIW petitioner pool. But the category
        is not limited to academics, and a PhD is not a requirement.
      </p>
      <p>
        Engineers, physicians, practitioners, founders, and professionals across dozens of fields
        qualify every year. The path is different — the evidence looks different, the prong arguments
        work differently — but the outcome can be the same.
      </p>

      <h2>The two non-academic paths to EB-2 eligibility</h2>
      <p>
        EB-2 requires either an <strong>advanced degree</strong> or <strong>exceptional ability</strong>
        in the sciences, arts, or business. Neither requires a PhD.
      </p>

      <h3>Path 1: Advanced degree equivalency</h3>
      <p>
        A U.S. bachelor's degree plus five years of progressive post-degree experience in your
        field is treated as the equivalent of an advanced degree for EB-2 purposes. This is the
        most common path for engineers and practitioners who have been working for several years
        after a bachelor's program.
      </p>
      <p>
        The critical word is "progressive." Random jobs in adjacent fields don't qualify.
        USCIS looks for a clear career trajectory showing deepening expertise in the specific
        field you're claiming. Promotions, increased responsibility, patents, products shipped,
        systems designed — all of these document progression.
      </p>
      <p>
        The documentation requirement is stricter than most people expect. You need: official
        employment records or letters from employers (not just a LinkedIn profile), W-2s or
        tax records showing continuous employment, and ideally third-party evidence of your
        level of expertise (conference presentations, patents, professional publications, awards).
      </p>

      <h3>Path 2: Exceptional ability</h3>
      <p>
        USCIS applies a six-criteria test from <em>Matter of Price</em>. To qualify under
        exceptional ability, you need to meet at least three of the six criteria:
      </p>
      <ol>
        <li>Official academic record showing a degree in the field of exceptional ability</li>
        <li>Ten or more years of full-time work experience in the field</li>
        <li>A license to practice the profession in the U.S. or abroad</li>
        <li>Evidence of commanding a salary that demonstrates exceptional ability</li>
        <li>Membership in professional associations that require outstanding achievement for admission</li>
        <li>Recognition for achievements and contributions from peers, government, or professional organizations</li>
      </ol>
      <p>
        Note what is and isn't there. A PhD is not on the list. High citation count is not on
        the list. What matters is documented evidence across the criteria you're claiming —
        official records, not narrative assertions.
      </p>

      <h2>Evidence that substitutes for academic citations</h2>
      <p>
        For academics, citations serve as the primary prong-2 evidence: they show independent
        validation of the work by the research community. For non-academics, equivalent evidence
        takes different forms.
      </p>

      <h3>For software engineers and technologists</h3>
      <ul>
        <li><strong>Patents:</strong> Issued U.S. patents, especially with broad claims and evidence of licensing or adoption</li>
        <li><strong>Open-source impact:</strong> GitHub stars/forks are weakly convincing alone; what's stronger is documented adoption at scale — production deployments, enterprise use, contributor network</li>
        <li><strong>Systems at scale:</strong> If you designed infrastructure serving millions of users, document it — technical architecture documents, engineering blog posts, industry recognition</li>
        <li><strong>Technical publications:</strong> Industry conference proceedings (OSDI, USENIX, SOSP, NeurIPS) carry significant weight for engineering prong-2 arguments, even without peer review in the traditional sense</li>
      </ul>

      <h3>For healthcare practitioners</h3>
      <ul>
        <li><strong>Clinical outcomes data:</strong> Documented patient outcomes that are above regional or national norms, with supporting institutional records</li>
        <li><strong>Clinical guidelines participation:</strong> Contributing to specialty society guidelines or clinical pathways</li>
        <li><strong>Medical staff appointments:</strong> Faculty appointments, department leadership, committee positions at major medical centers</li>
        <li><strong>Publications and presentations:</strong> Case reports, review articles, and conference presentations count even for primarily clinical practitioners</li>
      </ul>

      <h3>For founders and operators</h3>
      <ul>
        <li><strong>Venture funding:</strong> Capital raised from institutional investors is a documented signal of "well-positioned" — the investors have done diligence and believe in the applicant's ability to execute</li>
        <li><strong>Revenue and adoption:</strong> Documented traction is prong-2 evidence — you're not just proposing the endeavor, you've already demonstrated execution capability</li>
        <li><strong>IP and technology:</strong> Patents, trade secrets, proprietary technology with documented adoption</li>
      </ul>

      <h2>The prong arguments for non-PhD applicants</h2>
      <p>
        The three Dhanasar prongs apply identically regardless of degree type. But the way you
        build the arguments differs.
      </p>
      <p>
        <strong>Prong 1 (substantial merit and national importance):</strong> This works the same
        way — tie your proposed endeavor to a documented national priority. A software engineer
        working on cybersecurity infrastructure for critical systems can tie their work to the
        National Cybersecurity Strategy and NIST framework priorities just as easily as a
        researcher can.
      </p>
      <p>
        <strong>Prong 2 (well-positioned):</strong> This is where non-PhD applicants have to be
        most deliberate. Without a dissertation or academic publication record as a shorthand
        for domain expertise, you need to assemble the equivalent story from your professional record:
        patents, deployments, documented adoption, recommendation letters from U.S. institutions
        that specifically need your skills.
      </p>
      <p>
        <strong>Prong 3 (on balance beneficial to waive):</strong> Works the same as for PhD
        holders. The argument is about why the national interest requires waiving the labor market
        test — urgency, uniqueness, documented U.S. institutional need.
      </p>

      <div className="not-prose my-8 rounded-xl bg-surface-subtle border border-border-default px-6 py-5">
        <p className="text-sm font-semibold text-text-primary mb-2">How does your non-PhD record score against the Dhanasar prongs?</p>
        <p className="text-sm text-text-secondary mb-4">
          Our free assessment scores your record — PhD or not — against the three prongs USCIS
          actually uses. Honest output including where your record is thin.
        </p>
        <Link href="/check" className="btn btn-primary text-sm">Check my NIW odds — free</Link>
      </div>

      <p>
        For context on how citation-equivalent evidence is evaluated for engineering fields,
        see <Link href="/articles/niw-citations-how-many">how citations are assessed for NIW</Link>.
        The <Link href="/eb2-niw-guide">EB-2 NIW guide</Link> covers the EB-2 eligibility
        categories in full.
      </p>
      <p className="text-xs text-text-muted mt-8">Not legal advice. Consult a qualified U.S. immigration attorney before filing.</p>
    </div>
  );
}

// ── A4 ── NIW Citations: How Many? ────────────────────────────────────────────

const citationsMeta: ArticleMeta = {
  slug: "niw-citations-how-many",
  title: "How Many Citations Do You Need for EB-2 NIW?",
  dek: "There's no citation threshold for NIW — field-normalized percentile matters far more than raw count. Here's how USCIS actually evaluates citation evidence, by field.",
  description: "There's no magic citation number for EB-2 NIW. Learn how USCIS evaluates citations with field context, and what compensates when your citation record is thin.",
  datePublished: "2026-06-11",
  dateModified: "2026-06-11",
  readMinutes: 7,
  relatedSlugs: ["eb2-niw-without-phd", "eb2-niw-denial-reasons"],
  faqs: [
    { q: "Is there a minimum citation count for EB-2 NIW?", a: "No. USCIS does not publish or apply a minimum citation threshold. Cases with 50 citations have been approved; cases with 2,000 have been denied. What matters is how your citation record compares to others in your field at a similar career stage — field-normalized context." },
    { q: "Does Google Scholar count, or only Scopus/Web of Science?", a: "USCIS has not formally excluded any database. Google Scholar tends to count more citations (including gray literature and preprints). Web of Science and Scopus are peer-reviewed only and are generally considered more conservative but more credible. Including analysis from multiple sources and explaining the methodology is stronger than relying on one." },
    { q: "Can I still qualify with low citations if my papers are in top journals?", a: "Yes, but you need to frame it carefully. Journal impact factor and the prestige of the venue can compensate for low absolute citation counts — especially in fields where the publication volume is low (clinical medicine, engineering, niche STEM fields). Recommendation letters from independent experts contextualizing your venue selection are critical here." },
    { q: "Do self-citations count?", a: "Self-citations technically count but USCIS adjudicators and independent experts typically discount them. A citation analysis that excludes self-citations (or presents both figures) is stronger than one that doesn't address the question." },
  ],
  tldr: "There is no minimum citation count for EB-2 NIW. USCIS evaluates citations relative to field norms — a biomedical researcher with 200 citations may be weaker than an engineer with 40. Field-normalized percentile rank and citation diversity (independent citing authors) matter more than raw count.",
  takeaways: [
    "No citation floor exists in the regulations or USCIS Policy Manual",
    "Field-normalized percentile rank matters more than raw count — top 25% in your field is meaningful",
    "Citation diversity (number of independent citing authors) outweighs raw total citation count",
    "One highly-cited paper can anchor a petition more effectively than a long tail of low-citation work",
    "Citation trajectory (rising vs. declining) is part of the Prong 2 'well-positioned' analysis",
  ],
  sources: [
    { title: "USCIS Policy Manual — Extraordinary Ability Evidence (Vol. 6)", url: "https://www.uscis.gov/policy-manual/volume-6-part-f" },
    { title: "NIH iCite Research Output Tool — field-normalized citation metrics", url: "https://icite.od.nih.gov/" },
  ],
  pillar: "evidence-building",
};

function CitationsBody(): JSX.Element {
  return (
    <div className="prose">
      <p>
        The question gets asked constantly — on Reddit forums, in attorney consultations,
        in WhatsApp groups of researchers waiting on their priority dates. "How many citations
        do I need for NIW?"
      </p>
      <p>
        The honest answer is: there is no number. USCIS has never published a citation
        threshold, and cases with 50 citations are approved while cases with 5,000 are denied.
        The citation count is not what USCIS is actually evaluating.
      </p>
      <p>
        What matters is <strong>field-normalized context</strong> — how your citation record
        compares to others in your specific field, at a similar career stage, in comparable
        institutions. And what compensates when the record is thin.
      </p>

      <h2>Why raw citation counts mislead</h2>
      <p>
        Citation rates vary enormously across fields. A researcher in molecular biology
        operating in a large, active field may accumulate 1,000 citations from 10 papers.
        A researcher in geotechnical engineering with 10 papers may have 80 citations —
        and be in the 95th percentile for their field.
      </p>
      <p>
        Presenting 80 citations without context looks weak. Presenting 80 citations with
        a field-normalized analysis showing 95th-percentile placement looks strong. These
        are the same record. The difference is documentation.
      </p>

      <h2>Citation context by field (illustrative benchmarks)</h2>
      <p className="not-prose text-sm text-text-muted mb-2">These are approximate field benchmarks — actual ranges vary by career stage, subdiscipline, and publication venue.</p>
      <div className="not-prose overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left py-2 pr-4 font-semibold text-text-primary">Field</th>
              <th className="text-right py-2 pr-4 font-semibold text-text-primary">Median (10-yr career)</th>
              <th className="text-right py-2 font-semibold text-text-primary">Strong (top 20%)</th>
            </tr>
          </thead>
          <tbody className="text-text-secondary">
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4">Molecular biology / genomics</td><td className="py-2 pr-4 text-right">~800–2,000</td><td className="py-2 text-right">5,000+</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4">Machine learning / AI</td><td className="py-2 pr-4 text-right">~400–1,200</td><td className="py-2 text-right">3,000+</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4">Clinical medicine</td><td className="py-2 pr-4 text-right">~200–600</td><td className="py-2 text-right">1,500+</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4">Materials science</td><td className="py-2 pr-4 text-right">~300–800</td><td className="py-2 text-right">2,000+</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4">Civil / geotechnical engineering</td><td className="py-2 pr-4 text-right">~50–200</td><td className="py-2 text-right">400+</td></tr>
            <tr><td className="py-2 pr-4">Economics / public policy</td><td className="py-2 pr-4 text-right">~100–400</td><td className="py-2 text-right">1,000+</td></tr>
          </tbody>
        </table>
        <p className="text-xs text-text-muted mt-2">Source: Field citation norms synthesized from OpenAlex and Semantic Scholar data, 2024.</p>
      </div>

      <h2>What a strong citation analysis looks like</h2>
      <p>
        A citation analysis letter from a qualified expert (typically a senior researcher in
        your field with no prior relationship with you) should include:
      </p>
      <ul>
        <li>Your h-index and total citation count from one or more databases, with self-citations noted</li>
        <li>Comparison to field medians and top-20% thresholds for researchers at your career stage</li>
        <li>Identification of your most-cited papers and what they represent (seminal work, applied impact, methodological contribution)</li>
        <li>Any citations from highly influential downstream work — being cited by researchers who are themselves highly cited carries disproportionate weight</li>
        <li>Context for any outlier papers — one paper with 90% of total citations is worth explaining</li>
      </ul>

      <h2>What compensates for a thin citation record</h2>
      <p>
        Citations are one signal of research impact. They are not the only one, and for many
        fields and applicant types, other evidence is equally or more persuasive:
      </p>

      <h3>Journal and venue prestige</h3>
      <p>
        Publication in <em>Nature</em>, <em>Science</em>, <em>Cell</em>, or a top-tier
        field-specific journal (NEJM, JAMA, top IEEE transactions, etc.) signals quality that
        citation count doesn't always capture, especially early in a career or in niche subfields.
        Include the journal's impact factor and field ranking.
      </p>

      <h3>Invited peer review and editorial roles</h3>
      <p>
        Being asked to peer review for top journals is evidence that the field recognizes you
        as an expert. Editorial board membership is stronger evidence. Include formal
        documentation of these roles.
      </p>

      <h3>Grants and funding</h3>
      <p>
        A PI grant (especially federal — NIH, NSF, DOE, DARPA) is a signal that a peer-review
        committee deemed your research merit-worthy enough to fund. Include award letters,
        funding amounts, and grant numbers.
      </p>

      <h3>Downstream application evidence</h3>
      <p>
        For applied researchers, evidence that your work was adopted in practice — clinical
        guidelines citing your research, products built on your methodology, government reports
        citing your findings — is often more persuasive than additional citations.
      </p>

      <h2>The verification angle: how we check citations</h2>
      <p>
        PetitionHQ's <Link href="/verification">verification methodology</Link> cross-references
        citation data from OpenAlex (which aggregates from multiple sources) and normalizes it
        within your declared field. Our free assessment includes a citation-strength signal so
        you know where you stand before committing to a filing.
      </p>

      <div className="not-prose my-8 rounded-xl bg-surface-subtle border border-border-default px-6 py-5">
        <p className="text-sm font-semibold text-text-primary mb-2">See how your citation record compares in your field</p>
        <p className="text-sm text-text-secondary mb-4">
          Our free assessment cross-references your public record and gives you a field-normalized
          read on where your evidence stands.
        </p>
        <Link href="/check" className="btn btn-primary text-sm">Check my NIW record — free</Link>
      </div>

      <p>
        Not sure if your evidence adds up without a PhD? See{" "}
        <Link href="/articles/eb2-niw-without-phd">EB-2 NIW without a PhD</Link> for the
        non-academic evidence paths.
      </p>
      <p className="text-xs text-text-muted mt-8">Not legal advice. Consult a qualified U.S. immigration attorney before filing.</p>
    </div>
  );
}

// ── A5 ── NIW Recommendation Letters ─────────────────────────────────────────

const recLettersMeta: ArticleMeta = {
  slug: "niw-recommendation-letters",
  title: "NIW Recommendation Letters: Independent vs Dependent + Structure",
  dek: "The 60% independent rule, how to map letters to each Dhanasar prong, common kill-shots that tank otherwise strong petitions, and what to actually put in the letter.",
  description: "NIW recommendation letters require at least 60% from independent (non-collaborating) experts. Learn the per-prong mapping, structural requirements, and common mistakes.",
  datePublished: "2026-06-11",
  dateModified: "2026-06-11",
  readMinutes: 9,
  relatedSlugs: ["eb2-niw-rfe-response", "eb2-niw-denial-reasons"],
  faqs: [
    { q: "How many recommendation letters do I need for EB-2 NIW?", a: "There is no official minimum. Most strong petitions include 5–8 letters. Fewer than 4 is risky; more than 10 rarely adds value and can make the exhibit package unwieldy. Quality and independence matter more than count." },
    { q: "Who qualifies as an 'independent' recommender?", a: "An independent recommender is someone who knows your work from the literature or from professional reputation — not from a personal working relationship. Former PhD supervisors, co-authors, current or former colleagues, and direct collaborators are considered dependent, even if they are prominent researchers." },
    { q: "Can my letters be from abroad?", a: "Yes. USCIS does not require recommenders to be U.S.-based. International experts in your field are fully valid, and for global research fields, international recommenders are often more credible than domestic ones since they reflect a worldwide reputation." },
    { q: "Should the recommenders know each other?", a: "Ideally not. Having all five letters from the same lab, same institution, or same collaboration network looks like an organized support campaign rather than independent professional recognition. Diversity of institution, geography, and subdiscipline strengthens the independent-expert argument." },
  ],
  tldr: "NIW recommendation letters should be split roughly 60% independent (no prior collaboration) and 40% dependent. Each letter must address the three Dhanasar prongs — especially Prong 2 — not just describe your CV. Vague letters calling you 'exceptional' without specific evidence are the most common reason otherwise strong petitions receive RFEs.",
  takeaways: [
    "At least 3–4 of your 5–6 letters should come from independent recommenders with no prior collaboration",
    "Every letter must address Prong 2: why you specifically are well-positioned to advance your endeavor",
    "Prong 3 letters from policy-adjacent writers ('national interest') carry outsized evidentiary weight",
    "'Dr. X is exceptional' without specifics is a near-useless letter — precise impact statements are required",
    "Letters should anticipate adjudicator skepticism, not just praise — address the strongest counterargument",
  ],
  sources: [
    { title: "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)", url: "https://www.uscis.gov/sites/default/files/err/B5%20-%20Researchers%20and%20Developers/Decisions_Issued_in_2016/JAN192016_01B5203.pdf" },
    { title: "USCIS Policy Manual — National Interest Waiver (Vol. 6, Part F, Ch. 5)", url: "https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-5" },
  ],
  pillar: "evidence-building",
};

function RecLettersBody(): JSX.Element {
  return (
    <div className="prose">
      <p>
        Recommendation letters are the most labor-intensive component of an NIW petition —
        and the component most often done wrong. A petition with strong publications and a
        good proposed-endeavor statement fails when the letters are generic, from the wrong
        people, or don't map to the three Dhanasar prongs.
      </p>
      <p>
        Here is what strong letters look like, who should write them, and what gets petitions
        denied even when the underlying record is solid.
      </p>

      <h2>The independent vs dependent distinction</h2>
      <p>
        USCIS distinguishes between dependent and independent recommenders. Dependent recommenders
        have a direct professional relationship with the applicant: PhD supervisors, postdoc
        mentors, co-authors, colleagues in the same lab or department, professional collaborators.
      </p>
      <p>
        Independent recommenders know the applicant's work from the literature, from professional
        reputation, or from industry — without a direct working relationship. They cite the
        applicant's papers; they have used or built on the applicant's methods; they have read
        and evaluated the work from the outside.
      </p>
      <p>
        The practical benchmark: aim for at least 60% of your letters from truly independent
        experts. In a seven-letter petition, that's four or five independent letters and two or
        three dependent. Many strong petitions do better — six of seven independent.
      </p>
      <p>
        This is not a formal USCIS rule with a specific percentage threshold. It is the practice
        standard that reflects how adjudicators weight the letters.
      </p>

      <h2>Mapping letters to the three prongs</h2>
      <p>
        Every letter should address prong 2 (well-positioned to advance the endeavor) — it's
        the core function of a recommendation letter. But a well-designed letter set also covers
        the other prongs:
      </p>

      <h3>Prong 1: Substantial merit and national importance</h3>
      <p>
        One or two letters should explicitly address why the applicant's proposed work area
        has national importance — ideally from recommenders with specific expertise in the
        policy or applied context of the field (a government scientist, an industry researcher
        in a critical technology area, a researcher at a national lab). Generic statements
        ("this field is important") don't advance prong 1; specific, documented connections to
        national priorities do.
      </p>

      <h3>Prong 2: Well-positioned</h3>
      <p>
        This is the main job of most letters. Recommenders should describe: what they know
        about the applicant's work (specific papers, methods, contributions), how they became
        aware of the work (indicates independence), their assessment of the applicant's place
        in the field relative to peers, and why they believe the applicant specifically is
        capable of executing the proposed endeavor.
      </p>
      <p>
        Vague superlatives ("one of the best in the field") without specificity do not
        advance prong 2 effectively. What works: specific comparisons ("among the top 5% of
        researchers I have evaluated in this subfield"), specific citations to the applicant's
        work, specific descriptions of impact or adoption.
      </p>

      <h3>Prong 3: On balance beneficial to waive</h3>
      <p>
        Letters from U.S. institutional representatives (university research directors, national
        lab staff, industry technical leads) who specifically want the applicant to continue
        working in the U.S. are the strongest prong-3 evidence. These letters should state
        explicitly: why the U.S. entity benefits from this applicant's continued presence, why
        the work cannot wait for a PERM labor certification, and what specific programs or
        initiatives depend on the applicant's skills.
      </p>

      <h2>What goes in the letter: structural outline</h2>
      <p>
        A strong NIW recommendation letter typically runs 1.5–2.5 pages (single-spaced,
        professional letterhead) and follows this structure:
      </p>
      <ol>
        <li><strong>Recommender's credentials:</strong> Who they are, institutional affiliation, how long they've been in the field, their own recognition and expertise (publications, grants, positions held). This establishes why their assessment counts.</li>
        <li><strong>How they know the applicant's work:</strong> Specific mechanism (read their papers, cited their methods, attended their talks, reviewed their grants). This establishes independence or explains the relationship context for dependent recommenders.</li>
        <li><strong>Assessment of specific work:</strong> Three to five specific contributions, with enough detail to show the recommender actually read the papers. Vague praise is weak; specific analysis of specific papers is strong.</li>
        <li><strong>Prong-targeted assessment:</strong> Why the work has national importance (prong 1), why the applicant specifically is well-positioned (prong 2), and optionally why the U.S. benefits from this applicant remaining (prong 3).</li>
        <li><strong>Endorsement:</strong> A direct statement that the recommender believes approval is warranted, with the prong-3 argument if applicable.</li>
      </ol>

      <h2>Common kill-shots</h2>
      <ul>
        <li><strong>Template letters:</strong> Five letters that are clearly the same template with names swapped. USCIS adjudicators read hundreds of these and recognize templates immediately. Each letter should be unique in structure, voice, and specific examples.</li>
        <li><strong>Vague prong-1 statements:</strong> "AI is a critical field for the U.S." is not prong-1 support. It needs specificity: which federal priority document, which specific application, which documented gap.</li>
        <li><strong>No specificity on the applicant's work:</strong> A letter from a prominent scientist that doesn't cite a single specific paper by the applicant reads as a favor, not an assessment. USCIS discounts it accordingly.</li>
        <li><strong>Missing the proposed endeavor:</strong> Letters that discuss the applicant's past work but don't connect it to the specific proposed endeavor in the petition leave prong 2 incomplete.</li>
        <li><strong>All from the same institution:</strong> Five letters from the same university, especially the same department, is a weak independence argument even if all five are technically independent (never co-authored).</li>
      </ul>

      <div className="not-prose my-8 rounded-xl bg-surface-subtle border border-border-default px-6 py-5">
        <p className="text-sm font-semibold text-text-primary mb-2">Know which prongs your record is weakest on before you start gathering letters</p>
        <p className="text-sm text-text-secondary mb-4">
          Our free assessment scores your evidence against all three Dhanasar prongs — so you
          know which letters to prioritize before you contact anyone.
        </p>
        <Link href="/check" className="btn btn-primary text-sm">Check my NIW case — free</Link>
      </div>

      <p>
        If your petition has already received an RFE challenging your letters, see{" "}
        <Link href="/articles/eb2-niw-rfe-response">how to respond to an NIW RFE</Link>. The{" "}
        <Link href="/eb2-niw-guide">EB-2 NIW guide</Link> covers the full evidence framework.
      </p>
      <p className="text-xs text-text-muted mt-8">Not legal advice. Consult a qualified U.S. immigration attorney before filing.</p>
    </div>
  );
}

// ── A6 ── NIW Proposed Endeavor ───────────────────────────────────────────────

const endeavorMeta: ArticleMeta = {
  slug: "niw-proposed-endeavor",
  title: "The Proposed Endeavor Statement: NIW's Most Misunderstood Requirement",
  dek: "Prong-1 failures almost always start with a vague endeavor statement. Here's the specific vs generic distinction — with three anonymized good/bad pairs — and how to anchor to federal priorities.",
  description: "The proposed endeavor statement is where most NIW prong-1 failures begin. Learn the specific vs generic distinction, federal-priority anchoring, and three good/bad examples.",
  datePublished: "2026-06-11",
  dateModified: "2026-06-11",
  readMinutes: 8,
  relatedSlugs: ["dhanasar-prong-1-national-importance", "eb2-niw-denial-reasons"],
  faqs: [
    { q: "How long should my proposed endeavor statement be?", a: "There's no fixed length. A strong proposed-endeavor statement is typically 1–2 pages in the petition brief — long enough to be specific and to connect to national priorities, short enough that every sentence adds to the argument. Vague language that pads length is worse than a tight 1-page statement." },
    { q: "Can I change my proposed endeavor after filing?", a: "Not through a simple amendment. If your circumstances change materially, you may need to file a new petition. The proposed endeavor stated in the petition is what USCIS evaluates — it must reflect what you actually plan to do." },
    { q: "Does my job offer have to match my proposed endeavor?", a: "The NIW explicitly waives the job offer requirement. You don't need a job offer. However, your proposed endeavor must be something you are genuinely going to pursue — it cannot be a hypothetical or aspirational statement disconnected from your actual plans." },
    { q: "How specific does the proposed endeavor need to be?", a: "Specific enough that a USCIS adjudicator can understand exactly what you plan to do, why it matters nationally, and why you specifically are the right person to do it. If your statement could apply to any of 50,000 researchers in the same field, it is not specific enough." },
  ],
  tldr: "The proposed-endeavor statement is the foundation of a NIW petition. It must name a specific, concrete goal — not 'advance AI research' but 'develop probabilistic forecasting models for wildfire spread.' Generic statements are the leading cause of Prong 1 failures. Federal priority anchors transform a plausible endeavor into a legally-anchored one.",
  takeaways: [
    "The endeavor must be specific enough for USCIS to evaluate whether it has substantial merit",
    "National importance requires tying your work to published federal priorities — not just 'beneficial to the U.S.'",
    "Generic industry language ('improve efficiency,' 'advance innovation') almost always fails Prong 1",
    "Use PCAST reports, NSF strategic plans, and NIH priorities as explicit federal anchors",
    "The endeavor statement should be a clear claim that every supporting letter then corroborates",
  ],
  sources: [
    { title: "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)", url: "https://www.uscis.gov/sites/default/files/err/B5%20-%20Researchers%20and%20Developers/Decisions_Issued_in_2016/JAN192016_01B5203.pdf" },
    { title: "PCAST — National Priorities in Science and Technology", url: "https://www.whitehouse.gov/pcast/" },
    { title: "NSF Strategic Plan 2022–2026", url: "https://www.nsf.gov/publications/pub_summ.jsp?ods_key=nsf22068" },
  ],
  tableOfContents: [
    { heading: "What makes an endeavor specific enough", anchor: "what-makes-an-endeavor-specific-enough" },
    { heading: "National importance: what it actually requires", anchor: "national-importance-what-it-actually-requires" },
    { heading: "Federal priority anchors by field", anchor: "federal-priority-anchors-by-field" },
    { heading: "Good vs bad: anonymized examples", anchor: "good-vs-bad-anonymized-examples" },
  ],
  pillar: "eligibility",
};

function EndeavorBody(): JSX.Element {
  return (
    <div className="prose">
      <p>
        The proposed endeavor is the foundation of an EB-2 NIW petition. It is the specific
        work you plan to do in the United States, and it is what USCIS evaluates under
        prong 1 (substantial merit and national importance) and anchors the entire prong-2
        and prong-3 analysis.
      </p>
      <p>
        It is also where the majority of prong-1 failures originate.
      </p>

      <h2>The specific vs generic distinction</h2>
      <p>
        The most common error is describing a field instead of an endeavor. A field is a
        broad area of knowledge. An endeavor is a specific project, application, or body of
        work you are going to pursue.
      </p>
      <p>
        Here are three anonymized pairs — a weak version and a stronger version of the same
        applicant's proposed endeavor:
      </p>

      <h3>Example 1: Machine learning researcher</h3>
      <p><strong>Weak:</strong> "I propose to conduct research in artificial intelligence and machine learning, focusing on developing more efficient algorithms for natural language processing that can be applied across various industries."</p>
      <p><strong>Stronger:</strong> "I propose to develop interpretability methods for large language models deployed in high-stakes clinical decision support systems, with the specific goal of making AI-assisted diagnosis in oncology verifiably safe for FDA review. This work addresses the gap identified in the FDA's 2024 Action Plan for AI in Medical Devices and the NIH's Ethical and Responsible AI Initiative under the National AI Research Resource."</p>

      <h3>Example 2: Biomedical engineer</h3>
      <p><strong>Weak:</strong> "I will continue my research in biomedical engineering, specifically in developing novel drug delivery systems that can improve treatment outcomes for cancer patients."</p>
      <p><strong>Stronger:</strong> "I will develop lipid nanoparticle formulations for targeted delivery of CRISPR-Cas9 complexes to solid tumor microenvironments, in partnership with [U.S. academic medical center]. This work directly advances the NCI's Cancer Moonshot 2.0 program objectives — specifically the goal of reducing cancer mortality by 50% over the next 25 years — and builds on my prior FDA-reviewed preclinical data."</p>

      <h3>Example 3: Climate technology engineer</h3>
      <p><strong>Weak:</strong> "My proposed endeavor involves advancing renewable energy technologies to address climate change and reduce U.S. dependence on fossil fuels."</p>
      <p><strong>Stronger:</strong> "I propose to engineer grid-scale iron-air battery storage systems capable of 100-hour discharge cycles for renewable integration, addressing the intermittency gap that limits solar and wind penetration beyond 30% of grid capacity. This directly advances the DOE's Long-Duration Storage Shot (target: 90% cost reduction by 2030) and is supported by a Small Business Innovation Research grant from DOE ARPA-E."</p>

      <h2>The pattern: what makes the stronger versions work</h2>
      <p>
        In each case, the stronger version does the same things:
      </p>
      <ol>
        <li><strong>Names a specific technical problem</strong> — not just a field or technique</li>
        <li><strong>States a specific goal or outcome</strong> — not just "advancing" or "developing"</li>
        <li><strong>Names a specific U.S. program or document</strong> that establishes the national priority</li>
        <li><strong>Connects the applicant's prior work</strong> — establishing the well-positioned argument from within the endeavor statement itself</li>
        <li><strong>References a U.S. entity</strong> (institutional partner, grant, collaboration) — strengthening the prong-3 argument</li>
      </ol>

      <h2>Federal priority anchoring</h2>
      <p>
        Every strong proposed endeavor anchors to a documented national priority. The
        most commonly used sources:
      </p>
      <ul>
        <li><strong>NSTC Critical and Emerging Technologies List:</strong> 18 technology areas designated as national priorities, updated regularly</li>
        <li><strong>NIH Strategic Plans:</strong> Each NIH institute publishes a strategic plan; citing a specific initiative in a specific plan is more credible than "NIH priorities"</li>
        <li><strong>DOE programs:</strong> The Energy Earthshots initiative (Hydrogen Shot, Solar Futures, etc.) provide specific, citable targets</li>
        <li><strong>NSF priority areas:</strong> Convergence Accelerator tracks, AI institutes, and quantum information programs are well-documented</li>
        <li><strong>CHIPS and Science Act priorities:</strong> Semiconductor supply chain, domestic manufacturing, workforce development in targeted technologies</li>
        <li><strong>National Cybersecurity Strategy (2023):</strong> Five pillars with specific technology and workforce objectives</li>
      </ul>
      <p>
        The goal is not to check a box. It is to show USCIS an unambiguous connection between
        what you are doing and what the U.S. government has explicitly decided is a national
        priority. That connection — documented and specific — is prong 1.
      </p>

      <div className="not-prose my-8 rounded-xl bg-surface-subtle border border-border-default px-6 py-5">
        <p className="text-sm font-semibold text-text-primary mb-2">How does your proposed endeavor score against prong 1?</p>
        <p className="text-sm text-text-secondary mb-4">
          Our assessment asks about your specific field and proposed work, then maps it against
          documented U.S. national priorities — so you know your prong-1 strength before filing.
        </p>
        <Link href="/check" className="btn btn-primary text-sm">Check my NIW prong-1 strength — free</Link>
      </div>

      <p>
        For a deep dive on which fields map to which federal priorities, see the{" "}
        <Link href="/articles/dhanasar-prong-1-national-importance">Prong 1 national-importance deep-dive</Link>.
      </p>
      <p className="text-xs text-text-muted mt-8">Not legal advice. Consult a qualified U.S. immigration attorney before filing.</p>
    </div>
  );
}

// ── A7 ── NIW Timeline 2026 ───────────────────────────────────────────────────

const timelineMeta: ArticleMeta = {
  slug: "niw-premium-processing-timeline",
  title: "EB-2 NIW Timeline 2026: Premium Processing vs Standard",
  dek: "From evidence collection to approval: the end-to-end NIW timeline with premium processing (45 business days) and standard processing — plus the visa-bulletin caveat for India and China.",
  description: "The complete EB-2 NIW timeline for 2026: premium processing at 45 business days, standard at 12–24 months, plus the evidence collection and visa-bulletin wait that most guides skip.",
  datePublished: "2026-06-11",
  dateModified: "2026-06-11",
  readMinutes: 7,
  relatedSlugs: ["eb2-niw-denial-reasons", "eb2-niw-rfe-response"],
  faqs: [
    { q: "What is the current EB-2 NIW processing time?", a: "As of 2026, standard processing for Form I-140 EB-2 NIW petitions is approximately 8–24 months depending on USCIS service center workload. Premium processing guarantees an initial adjudication response within 45 business days (not calendar days) for an additional $2,805 fee." },
    { q: "Does premium processing guarantee approval?", a: "No. Premium processing guarantees USCIS will issue an approval, denial, or RFE within 45 business days. If they issue an RFE, the clock pauses and you have 87 days to respond. Premium processing does not affect the adjudication standards or outcome probability." },
    { q: "What happens after I-140 approval for EB-2 NIW?", a: "For U.S.-based applicants, the next step is adjustment of status (I-485) if a visa number is immediately available in your priority queue. For applicants outside the U.S., consular processing. India and China-born applicants face multi-year visa backlogs in the EB-2 category regardless of I-140 status." },
    { q: "Can I start working in the U.S. while my I-140 is pending?", a: "Not based on the I-140 alone. You need a separate work authorization (H-1B, O-1, TN, or other non-immigrant status) to work in the U.S. while your I-140 is pending. The I-140 approval does not itself grant work authorization." },
  ],
  tldr: "EB-2 NIW premium processing guarantees a response within 45 business days (roughly 9 calendar weeks). Standard processing is 12–24 months in 2026. Premium processing does not improve approval odds. India- and China-born petitioners should check the visa bulletin before upgrading — a fast I-140 won't accelerate a decade-long priority date queue.",
  takeaways: [
    "Premium processing guarantees a decision within 45 business days, not 45 calendar days",
    "Premium processing does not increase approval odds — it only delivers a defined timeline",
    "India and China-born petitioners face visa retrogression extending total waits to 10+ years regardless of I-140 speed",
    "You can upgrade to premium processing after filing (Form I-907) if USCIS hasn't touched the case yet",
    "An RFE response does not reset the 45-day clock — the clock pauses during the RFE response window",
  ],
  sources: [
    { title: "USCIS Premium Processing Times", url: "https://www.uscis.gov/forms/filing-guidance/premium-processing-times" },
    { title: "U.S. Visa Bulletin — Current Priority Dates", url: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html" },
    { title: "USCIS Form I-907 — Request for Premium Processing", url: "https://www.uscis.gov/i-907" },
  ],
  tableOfContents: [
    { heading: "The four timeline phases", anchor: "the-four-timeline-phases" },
    { heading: "Premium vs standard: what the data shows", anchor: "premium-vs-standard-what-the-data-shows" },
    { heading: "The visa bulletin caveat for India and China", anchor: "the-visa-bulletin-caveat-for-india-and-china" },
    { heading: "After I-140 approval: next steps", anchor: "after-i-140-approval-next-steps" },
  ],
  pillar: "filing-timeline",
};

function TimelineBody(): JSX.Element {
  return (
    <div className="prose">
      <p>
        The EB-2 NIW timeline is longer than most applicants expect — and shorter in the
        I-140 adjudication phase than most assume for premium processing. The timeline has
        four distinct phases, only one of which USCIS controls directly. Here is the complete
        picture for 2026.
      </p>

      <h2>The four phases</h2>

      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left py-2 pr-4 font-semibold text-text-primary">Phase</th>
              <th className="text-left py-2 pr-4 font-semibold text-text-primary">Who controls it</th>
              <th className="text-right py-2 font-semibold text-text-primary">Typical duration</th>
            </tr>
          </thead>
          <tbody className="text-text-secondary">
            <tr className="border-b border-border-subtle">
              <td className="py-2 pr-4">Evidence collection &amp; petition preparation</td>
              <td className="py-2 pr-4">You + attorney</td>
              <td className="py-2 text-right">3–9 months</td>
            </tr>
            <tr className="border-b border-border-subtle">
              <td className="py-2 pr-4">I-140 adjudication (premium)</td>
              <td className="py-2 pr-4">USCIS</td>
              <td className="py-2 text-right">~9–13 weeks</td>
            </tr>
            <tr className="border-b border-border-subtle">
              <td className="py-2 pr-4">I-140 adjudication (standard)</td>
              <td className="py-2 pr-4">USCIS</td>
              <td className="py-2 text-right">8–24 months</td>
            </tr>
            <tr className="border-b border-border-subtle">
              <td className="py-2 pr-4">Adjustment of status / consular processing</td>
              <td className="py-2 pr-4">USCIS + DOS</td>
              <td className="py-2 text-right">8–18 months (no backlog)</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">Visa backlog wait (India/China EB-2)</td>
              <td className="py-2 pr-4">Visa bulletin (DOS)</td>
              <td className="py-2 text-right">10–30+ years (current)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Phase 1: Evidence collection — the long pole nobody talks about</h2>
      <p>
        The step that takes longest is the one you control. Gathering independent recommendation
        letters, commissioning a citation analysis, assembling the exhibit package, and writing
        a strong proposed-endeavor statement with federal-priority documentation takes
        three to nine months for most applicants.
      </p>
      <p>
        The most time-consuming components: independent recommenders (typically 4–8 weeks
        from first contact to letter in hand, if they agree quickly), field-normalized citation
        analysis (2–4 weeks for a qualified expert), and attorney brief preparation (2–6 weeks
        depending on complexity).
      </p>
      <p>
        Do not rush this phase. The evidence quality determines the adjudication outcome.
        An extra month spent strengthening the record is cheaper than a six-month RFE cycle
        plus the re-preparation cost.
      </p>

      <h2>Phase 2: Premium processing</h2>
      <p>
        Premium processing for I-140 is available for EB-2 NIW. The current fee is $2,805
        (as of 2026, subject to USCIS fee schedule updates). It guarantees USCIS will issue
        one of three responses within <strong>45 business days</strong>:
      </p>
      <ul>
        <li><strong>Approval:</strong> I-140 approved — move to adjustment of status or consular processing</li>
        <li><strong>Request for Evidence (RFE):</strong> Clock pauses; you have 87 days to respond; premium-processing clock restarts after your response</li>
        <li><strong>Notice of Intent to Deny (NOID):</strong> Rare; similar to an RFE but USCIS has tentatively decided to deny — you have the same response period</li>
      </ul>
      <p>
        45 business days is approximately 9 calendar weeks (excluding federal holidays).
        Add the response-and-readjudication cycle if an RFE is issued, and a premium-processing
        case with a clean record typically resolves in 3–4 months total.
      </p>

      <h2>Phase 3: Adjustment of status or consular processing</h2>
      <p>
        Once the I-140 is approved, applicants without an immediate visa number wait. Applicants
        with an immediately available visa number (or concurrent filing on the I-485) can move
        quickly — adjustment of status (I-485) currently takes 8–18 months at most service centers.
      </p>
      <p>
        Consular processing for applicants abroad adds 6–12 months for the NVC and consular
        interview steps.
      </p>

      <h2>The visa backlog: the number most applicants don't know</h2>
      <p>
        For applicants born in India or China, the EB-2 visa backlog is the dominant timeline
        factor — not I-140 processing.
      </p>
      <p>
        The Department of State's Visa Bulletin controls when a visa number becomes available
        based on the applicant's country of birth and the EB-2 priority date. As of 2026, India
        EB-2 applicants are seeing priority dates from approximately 2012 move forward — meaning
        individuals who filed their I-140 in 2012 are only now becoming eligible for adjustment.
        China EB-2 is less severe but still multi-year.
      </p>
      <p>
        For India and China-born applicants, the I-140 approval is a milestone — not the end.
        The practical timeline to green card status is measured in decades under current
        congressional caps and annual per-country limits. This should factor into whether and
        when to file, and which non-immigrant status to maintain during the wait.
      </p>

      <div className="not-prose my-8 rounded-xl bg-surface-subtle border border-border-default px-6 py-5">
        <p className="text-sm font-semibold text-text-primary mb-2">Is your case ready to file? Find out in 5 minutes.</p>
        <p className="text-sm text-text-secondary mb-4">
          Filing an unready case into a 12–24 month queue wastes the wait. Our free assessment
          tells you where you stand before you commit.
        </p>
        <Link href="/check" className="btn btn-primary text-sm">Check my NIW readiness — free</Link>
      </div>

      <p>
        If you receive an RFE during the premium-processing window, see{" "}
        <Link href="/articles/eb2-niw-rfe-response">how to respond to an NIW RFE</Link>.
      </p>
      <p className="text-xs text-text-muted mt-8">Not legal advice. USCIS fees and processing times change; verify current figures at uscis.gov. Consult a qualified U.S. immigration attorney.</p>
    </div>
  );
}

// ── A8 ── EB-2 NIW Cost Breakdown ─────────────────────────────────────────────

const costMeta: ArticleMeta = {
  slug: "eb2-niw-cost",
  title: "EB-2 NIW Total Cost Breakdown (2026): Fees, Attorney, Hidden",
  dek: "The honest total: USCIS filing fees, attorney costs, premium processing, and the hidden cost of filing too early. With a complete cost table and the ROI math on waiting.",
  description: "EB-2 NIW total cost in 2026: USCIS I-140 fee $715, premium processing $2,805, attorney fees $3,000–$12,000, plus adjustment of status costs. Full breakdown with the math on filing too early.",
  datePublished: "2026-06-11",
  dateModified: "2026-06-11",
  readMinutes: 7,
  relatedSlugs: ["eb2-niw-denial-reasons", "niw-premium-processing-timeline"],
  faqs: [
    { q: "What is the USCIS filing fee for EB-2 NIW?", a: "The I-140 immigrant visa petition fee is $715 as of 2026 (subject to USCIS fee schedule updates). Premium processing adds $2,805. Biometrics (if required) adds $85. The total USCIS-only cost for an I-140 with premium processing is approximately $3,600." },
    { q: "How much do immigration attorneys charge for EB-2 NIW?", a: "Attorney fees for EB-2 NIW I-140 preparation range from $3,000 to $12,000+ depending on complexity, attorney experience, and geographic market. Most established NIW boutiques charge $4,000–$8,000 for I-140 preparation only. RFE response typically costs $2,000–$5,000 additional." },
    { q: "Can I file EB-2 NIW without an attorney?", a: "Yes. There is no legal requirement to use an attorney for an I-140 filing. However, the NIW category requires a substantive legal brief (the proposed-endeavor and prong-by-prong analysis), and the error rate in self-prepared petitions is significantly higher. For borderline cases in particular, attorney preparation often improves outcomes by more than its cost." },
    { q: "What does EB-2 NIW cost if I also file for adjustment of status?", a: "Adjustment of status (I-485) adds $1,440 per applicant (as of 2026 fee schedule) plus biometrics ($85) and an optional EAD/advance parole combo card ($520). For a principal applicant only, the I-485 stage adds approximately $2,000–$2,500 in government fees." },
  ],
  tldr: "Filing an EB-2 NIW self-petition costs $715 in USCIS I-140 fees. Adding premium processing adds $2,805. Total attorney fees range from $3,000–$8,000. Adjustment-of-status (I-485) for those in the U.S. adds another $1,440 plus $1,365 per dependent. The main hidden cost is filing too early and absorbing a denial.",
  takeaways: [
    "USCIS I-140 base fee: $715; premium processing: $2,805; biometrics: $85 if required",
    "Attorney fees range from $3,000 (document preparer) to $8,000+ (experienced NIW litigator)",
    "I-485 adjustment of status adds $1,440 per principal petitioner plus $1,365 per dependent",
    "Premium processing is additive to USCIS fees — it doesn't reduce the base filing cost",
    "The ROI on professional legal help is highest for Prong 2 arguments and the proposed-endeavor statement",
  ],
  sources: [
    { title: "USCIS Fee Schedule — Form I-140", url: "https://www.uscis.gov/i-140" },
    { title: "USCIS Form I-485 — Application to Register Permanent Residence", url: "https://www.uscis.gov/i-485" },
    { title: "USCIS Form I-907 — Request for Premium Processing Service", url: "https://www.uscis.gov/i-907" },
  ],
  pillar: "filing-timeline",
};

function CostBody(): JSX.Element {
  return (
    <div className="prose">
      <p>
        EB-2 NIW costs are frequently quoted at the low end ("you can do it for under $2,000!")
        and the high end ("expect $20,000 all-in"). The truth is more specific — and knowing
        the real numbers helps you plan, compare attorneys, and evaluate whether your case is
        ready to file financially.
      </p>

      <h2>Complete cost table (2026)</h2>
      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left py-2 pr-4 font-semibold text-text-primary">Cost item</th>
              <th className="text-left py-2 pr-4 font-semibold text-text-primary">Type</th>
              <th className="text-right py-2 font-semibold text-text-primary">Amount</th>
            </tr>
          </thead>
          <tbody className="text-text-secondary">
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4">I-140 USCIS filing fee</td><td className="py-2 pr-4">Government</td><td className="py-2 text-right">$715</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4">Premium processing (I-907)</td><td className="py-2 pr-4">Government (optional)</td><td className="py-2 text-right">$2,805</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4">Attorney fees — I-140 preparation</td><td className="py-2 pr-4">Attorney</td><td className="py-2 text-right">$3,000–$12,000</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4">Citation analysis letter</td><td className="py-2 pr-4">Expert witness</td><td className="py-2 text-right">$500–$1,500</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4">Credential evaluation (if needed)</td><td className="py-2 pr-4">NACES member</td><td className="py-2 text-right">$150–$350</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4">RFE response (if received)</td><td className="py-2 pr-4">Attorney</td><td className="py-2 text-right">$2,000–$5,000</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4">I-485 adjustment of status</td><td className="py-2 pr-4">Government + attorney</td><td className="py-2 text-right">$2,000–$5,000</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4">Medical exam (I-693)</td><td className="py-2 pr-4">USCIS civil surgeon</td><td className="py-2 text-right">$200–$500</td></tr>
            <tr><td className="py-2 pr-4 font-semibold text-text-primary">Total range (I-140 only, no RFE)</td><td className="py-2 pr-4"></td><td className="py-2 text-right font-semibold text-text-primary">$4,000–$15,000</td></tr>
          </tbody>
        </table>
        <p className="text-xs text-text-muted mt-2">Government fees as of 2026. Verify current amounts at uscis.gov before filing.</p>
      </div>

      <h2>Where the variation comes from</h2>

      <h3>Attorney fees</h3>
      <p>
        The $3,000–$12,000 range is real and reflects material differences, not just markup.
        The key factors:
      </p>
      <ul>
        <li><strong>NIW specialization:</strong> A general immigration attorney charging $3,500 may have filed 20 NIW petitions. A boutique NIW firm charging $7,000 may have filed 2,000. Track record in the specific category matters.</li>
        <li><strong>Brief quality:</strong> The petition brief is the core product. Attorney skill at building a prong-by-prong argument specific to your record varies enormously.</li>
        <li><strong>RFE inclusion:</strong> Some flat fees include RFE response; others don't. Get clarity on this before signing an engagement letter.</li>
      </ul>

      <h3>Premium processing</h3>
      <p>
        At $2,805, premium processing is expensive — but for most applicants, the math favors it.
        Standard processing at 8–24 months means uncertainty about employment authorization
        (if you're transitioning from H-1B or OPT), delayed planning, and the psychological
        cost of waiting. A clean case resolves in 9–13 weeks with premium.
      </p>

      <h2>The hidden cost: filing too early</h2>
      <p>
        The most expensive NIW cost is one that doesn't appear on any fee schedule: the cost
        of filing a borderline case in the current adjudication environment.
      </p>
      <p>
        A denial costs you: the full filing fee (non-refundable), attorney fees (typically
        non-refundable), and — most importantly — the processing time. Filing a denial, then
        spending 6 months strengthening the record, then refiling costs approximately
        double the initial filing cost. And you've lost 18–24 months.
      </p>
      <p>
        A RFE cycle in the current environment (roughly 1 in 2 petitions) adds $2,000–$5,000
        in attorney response costs, 4–8 months to the timeline, and significant stress. For
        a borderline case, the expected cost including likely-RFE probability is substantially
        higher than the fee schedule alone suggests.
      </p>
      <p>
        The ROI math on waiting three to six months to strengthen a borderline record is often
        positive — not just in probability of approval, but in total expected cost.
      </p>

      <div className="not-prose my-8 rounded-xl bg-surface-subtle border border-border-default px-6 py-5">
        <p className="text-sm font-semibold text-text-primary mb-2">Know if your record is ready before you write the check</p>
        <p className="text-sm text-text-secondary mb-4">
          Our free assessment gives you an honest tier rating — Strong, Promising, Borderline,
          or Not yet ready — before you commit $5,000–$15,000 to a filing.
        </p>
        <Link href="/check" className="btn btn-primary text-sm">Check my NIW readiness — free</Link>
      </div>

      <p>
        For the timeline and what happens after I-140 approval, see{" "}
        <Link href="/articles/niw-premium-processing-timeline">EB-2 NIW processing timeline 2026</Link>.
        For the denial patterns driving the higher RFE rate, see{" "}
        <Link href="/articles/eb2-niw-denial-reasons">why EB-2 NIW petitions get denied</Link>.
      </p>
      <p className="text-xs text-text-muted mt-8">Not legal advice. Government fees change; verify at uscis.gov. Consult a qualified U.S. immigration attorney.</p>
    </div>
  );
}

// ── A9 ── NIW for Physicians ──────────────────────────────────────────────────

const physiciansMeta: ArticleMeta = {
  slug: "niw-for-physicians",
  title: "EB-2 NIW for Physicians & IMGs: Beyond the Schedule-A Myths",
  dek: "Most physician NIW guides conflate NIW with Schedule-A or PNIW. Here's when the Dhanasar standard applies — and what a physician NIW petition actually looks like.",
  description: "EB-2 NIW for physicians in 2026: how Dhanasar NIW differs from Schedule-A and PNIW, clinical vs research paths, and what evidence IMGs need to build a strong prong-2 argument.",
  datePublished: "2026-06-11",
  dateModified: "2026-06-11",
  readMinutes: 8,
  relatedSlugs: ["niw-citations-how-many", "eb2-niw-denial-reasons"],
  faqs: [
    { q: "What is the difference between EB-2 NIW, PNIW, and Schedule-A for physicians?", a: "Schedule-A is a pre-approved labor certification waiver for shortage-area physicians (typically primary care in underserved areas, with a J-1 waiver). PNIW is a congressional NIW variant for physicians who commit to 5 years of service in underserved areas. Standard EB-2 NIW under Dhanasar requires demonstrating substantial merit, being well-positioned, and showing it's in the national interest to waive the job requirement — with no geographic or specialty restriction." },
    { q: "Can specialist physicians qualify for EB-2 NIW?", a: "Yes. Specialists in fields with documented national shortage (oncology, psychiatry, rural emergency medicine) are strong candidates. Research-active specialists can build a Dhanasar NIW argument through both clinical impact and academic contributions." },
    { q: "Do I need publications to qualify for NIW as a physician?", a: "Not necessarily. Clinical NIW arguments can be built on clinical outcomes, practice impact, shortage-area work, and institutional need without requiring a research publication record. However, publications significantly strengthen a physician NIW petition, especially for specialists." },
    { q: "Can a physician in residency apply for EB-2 NIW?", a: "Technically yes, but practically difficult. NIW requires demonstrating a substantial existing record of contribution — which is hard to establish mid-residency. Most immigration practitioners advise waiting until at least year 2–3 of residency or post-residency before the record is strong enough to support a NIW petition." },
  ],
  tldr: "Physicians can file EB-2 NIW directly under Dhanasar — no Schedule A or J-waiver required. The key is separating the clinical endeavor from the national-interest endeavor. Most physician NIW denials fail on Prong 2 because the petition conflates the physician's general skill with specific impact on a documented national health priority.",
  takeaways: [
    "Physicians can file NIW without a U.S. job offer, J-waiver fulfillment, or Schedule A certification",
    "The Dhanasar standard requires a specific proposed endeavor — 'practicing medicine' is too generic to satisfy Prong 1",
    "Strong physician NIWs anchor to medically underserved populations or HRSA-documented national health priorities",
    "Research output strengthens but does not replace the Dhanasar three-prong analysis",
    "Physicians who treat patients exclusively face a harder Prong 2 argument than physician-researchers",
  ],
  sources: [
    { title: "HRSA Health Professional Shortage Areas (HPSA) Designations", url: "https://bhw.hrsa.gov/workforce-shortage-areas/shortage-designation" },
    { title: "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)", url: "https://www.uscis.gov/sites/default/files/err/B5%20-%20Researchers%20and%20Developers/Decisions_Issued_in_2016/JAN192016_01B5203.pdf" },
    { title: "USCIS Policy Manual — National Interest Waiver (Vol. 6, Part F)", url: "https://www.uscis.gov/policy-manual/volume-6-part-f" },
  ],
  pillar: "eligibility",
};

function PhysiciansBody(): JSX.Element {
  return (
    <div className="prose">
      <p>
        Physician immigration is complicated by three overlapping pathways that are frequently
        confused — Schedule-A, PNIW, and standard Dhanasar NIW — each with fundamentally
        different requirements, geographic restrictions, and service obligations. Most guides
        conflate them. Here is the clear distinction, and what standard EB-2 NIW actually
        requires for physicians.
      </p>

      <h2>The three physician pathways: clear distinctions</h2>

      <h3>Schedule-A Group II (labor certification waiver)</h3>
      <p>
        Schedule-A predates the Dhanasar standard and operates on a different statutory basis.
        It is available to physicians who commit to practice in a designated shortage area
        (typically a Health Professional Shortage Area or Medically Underserved Area) with a
        J-1 waiver obligation. USCIS pre-approves the labor certification element. It requires
        a U.S. employer sponsor and geographic restriction on practice.
      </p>
      <p>
        Schedule-A is a labor certification waiver — it is not an NIW. The underlying petition
        is still an EB-2 preference petition, but the Dhanasar prong analysis does not apply.
        The requirements are entirely different.
      </p>

      <h3>PNIW (Physician National Interest Waiver)</h3>
      <p>
        PNIW is a congressionally created variant under INA §203(b)(2)(B)(ii). It requires
        physicians to commit to five years of full-time clinical practice in a HPSA, MUA,
        or VA-designated site. The NIW is granted based on the commitment — not on the
        Dhanasar prong analysis. An approved PNIW petition requires the physician to actually
        fulfill the service obligation; if they don't, the green card is revocable.
      </p>

      <h3>Standard EB-2 NIW under Dhanasar</h3>
      <p>
        This is the Dhanasar standard NIW applied to a physician's professional record.
        It requires the three prongs — substantial merit and national importance, well-positioned,
        and on balance beneficial. There is no geographic restriction, no service obligation,
        and no J-1 waiver requirement. The analysis is identical to any other EB-2 NIW petition;
        it simply needs to be built from a physician's specific evidence.
      </p>

      <h2>Clinical vs research paths to Dhanasar NIW</h2>

      <h3>The research path</h3>
      <p>
        Physician-scientists with peer-reviewed publications and verifiable citation records
        build NIW petitions that look similar to non-physician academic petitions. The core
        prong-2 evidence is the research record: publications in peer-reviewed clinical or
        basic science journals (NEJM, JAMA, BMJ, specialty journals with strong impact factors),
        citation analysis, grants (NIH K-awards, R01s, foundation grants), conference presentations.
      </p>
      <p>
        The proposed endeavor for physician-scientists is typically a specific research program
        with a named clinical-translation or public-health goal — tied to NIH priority areas,
        NCI Cancer Moonshot objectives, or documented public health gaps.
      </p>

      <h3>The clinical impact path</h3>
      <p>
        Primarily clinical physicians without research records can build Dhanasar NIW petitions
        from clinical evidence — but it requires more deliberate documentation:
      </p>
      <ul>
        <li><strong>Outcomes data:</strong> Documented patient outcomes above national benchmarks, supported by institutional records or published quality-improvement data</li>
        <li><strong>Shortage-area practice:</strong> Practice in a documented shortage area is strong prong-1 and prong-3 evidence, even without the PNIW service obligation (you're demonstrating national importance without being required to)</li>
        <li><strong>Specialty society recognition:</strong> Fellow status, committee membership, guideline participation, specialty board positions</li>
        <li><strong>Training and education impact:</strong> Residency program directorship, medical student mentorship, curriculum development with documented adoption</li>
        <li><strong>Innovation and technology:</strong> Patents, clinical protocols adopted beyond your institution, quality-improvement programs replicated at other sites</li>
      </ul>

      <h2>PubMed-verifiable records: the verification advantage</h2>
      <p>
        Physicians have an advantage in NIW verification that many don't use: their entire
        research record is publicly verifiable through PubMed, which is structured data with
        full author disambiguation, institutional affiliation, and citation tracking.
      </p>
      <p>
        A physician's NIW petition that includes a PubMed-verified citation analysis —
        cross-referenced against field norms for clinical medicine specifically — is more
        credible than one that relies on Google Scholar alone, because PubMed is the
        authoritative clinical literature database and USCIS adjudicators and expert witnesses
        treat it as such.
      </p>

      <h2>What weak physician NIW petitions look like</h2>
      <ul>
        <li>Generic proposed endeavor ("I will continue to practice medicine in the United States")</li>
        <li>No field-normalized citation analysis — raw publication count without context</li>
        <li>Letters only from current colleagues and department chair (all dependent recommenders)</li>
        <li>Confusing PNIW and standard NIW in the petition brief (signals unfamiliarity with the category)</li>
        <li>No specific documented shortage-area or national-priority connection in prong-1</li>
      </ul>

      <div className="not-prose my-8 rounded-xl bg-surface-subtle border border-border-default px-6 py-5">
        <p className="text-sm font-semibold text-text-primary mb-2">How does your clinical record score against the Dhanasar prongs?</p>
        <p className="text-sm text-text-secondary mb-4">
          Our assessment evaluates physician records — clinical and research — against the same
          prong framework USCIS uses. Honest result including gaps.
        </p>
        <Link href="/check" className="btn btn-primary text-sm">Check my NIW case — free</Link>
      </div>

      <p>
        For context on how citation records are evaluated for clinical fields, see{" "}
        <Link href="/articles/niw-citations-how-many">how many citations you need for NIW</Link>.
      </p>
      <p className="text-xs text-text-muted mt-8">Not legal advice. The PNIW service obligation has legal implications — consult a qualified U.S. immigration attorney before choosing between pathways.</p>
    </div>
  );
}

// ── A10 ── Dhanasar Prong 1 Deep-Dive ─────────────────────────────────────────

const prong1Meta: ArticleMeta = {
  slug: "dhanasar-prong-1-national-importance",
  title: "Prong 1 Deep-Dive: Proving National Importance (with Federal Priority Map)",
  dek: "How USCIS reads Prong 1, what 'national importance' actually requires, and a field-by-field map of the federal strategy documents that make the strongest anchors.",
  description: "The complete guide to EB-2 NIW Prong 1: what 'substantial merit and national importance' means, how USCIS adjudicators evaluate it, and a federal priority map for 12 key fields.",
  datePublished: "2026-06-11",
  dateModified: "2026-06-11",
  readMinutes: 10,
  relatedSlugs: ["niw-proposed-endeavor", "eb2-niw-denial-reasons"],
  faqs: [
    { q: "What does 'national importance' mean for EB-2 NIW?", a: "USCIS interprets 'national importance' as requiring that the proposed endeavor has implications beyond a local or regional level — it must have a potential impact on the U.S. as a whole. USCIS has recognized national importance in fields from fundamental research to applied commercial work, as long as the specific endeavor has documented U.S.-level implications." },
    { q: "Does my proposed endeavor have to be in a STEM field for NIW?", a: "No. USCIS has approved NIW petitions in arts, business, education, healthcare policy, and other non-STEM fields. The national-importance requirement applies regardless of field; the key is documenting a specific U.S.-level benefit, not the field category." },
    { q: "Can I change my proposed endeavor after I-140 approval?", a: "The NIW does not lock you to a specific employer, but materially changing your proposed endeavor after approval could theoretically be raised in adjustment of status proceedings if USCIS questions whether you are pursuing the endeavor you described. In practice, the bar for what constitutes a material change is unclear; consult an attorney if your circumstances change significantly." },
    { q: "What federal document should I cite for my field?", a: "The NSTC Critical and Emerging Technologies (CET) List is the most broadly cited across technology fields. For biomedical research, NIH Strategic Plans for each institute. For energy, DOE program documents. For national security, NSTC publications and CISA strategy documents. For healthcare access, HHS health equity and shortage-area designation documents." },
  ],
  tldr: "Prong 1 requires showing your endeavor has substantial merit (a genuine, meaningful goal) and national importance (alignment with federal priorities, not just your career). USCIS does not require national security stakes — but 'nationally important' must mean more than 'good for society.' PCAST reports and NIH roadmaps are the most reliable documentary anchors.",
  takeaways: [
    "Prong 1 has two sub-requirements: substantial merit AND national importance — both must be separately established",
    "'Nationally important' does not require a unique contribution; it requires documented federal alignment",
    "PCAST reports, NSF strategic plans, NIH priority lists, and USDA research goals are the most citable federal anchors",
    "Social-science and humanities fields require more deliberate work to establish federal alignment than STEM",
    "Prong 1 failures are almost always due to insufficient specificity, not insufficient merit of the underlying work",
  ],
  sources: [
    { title: "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016)", url: "https://www.uscis.gov/sites/default/files/err/B5%20-%20Researchers%20and%20Developers/Decisions_Issued_in_2016/JAN192016_01B5203.pdf" },
    { title: "PCAST — President's Council of Advisors on Science and Technology", url: "https://www.whitehouse.gov/pcast/" },
    { title: "NIH Research Priority Areas", url: "https://grants.nih.gov/grants/guide/notice-files/NOT-OD-24-084.html" },
    { title: "NSF Strategic Plan 2022–2026", url: "https://www.nsf.gov/publications/pub_summ.jsp?ods_key=nsf22068" },
  ],
  tableOfContents: [
    { heading: "Substantial merit: the first half of Prong 1", anchor: "substantial-merit-the-first-half-of-prong-1" },
    { heading: "National importance: what USCIS actually requires", anchor: "national-importance-what-uscis-actually-requires" },
    { heading: "Federal priority map by field", anchor: "federal-priority-map-by-field" },
    { heading: "Common Prong 1 failure patterns", anchor: "common-prong-1-failure-patterns" },
  ],
  pillar: "eligibility",
};

function Prong1Body(): JSX.Element {
  return (
    <div className="prose">
      <p>
        Prong 1 of the <em>Matter of Dhanasar</em> framework requires demonstrating that the
        proposed endeavor has "substantial merit and national importance." Of the three prongs,
        it is the one most commonly treated as a formality — and the one that produces the
        most preventable failures.
      </p>
      <p>
        Here is how USCIS actually reads prong 1, what distinguishes strong from weak arguments,
        and a field-by-field map of the federal priority documents that make the strongest anchors.
      </p>

      <h2>What "substantial merit and national importance" actually means</h2>
      <p>
        USCIS interprets the two components separately:
      </p>
      <p>
        <strong>Substantial merit</strong> means the work is legitimate, consequential, and
        recognized within its field. For most academic applicants with publications, this prong
        is relatively easy to establish. For early-career or non-academic applicants, the
        documentation of field recognition becomes more important.
      </p>
      <p>
        <strong>National importance</strong> is the harder part. It requires showing that the
        proposed endeavor has implications beyond the applicant's individual career or local
        impact — that the work affects the U.S. at a broad level. USCIS explicitly notes in
        <em>Dhanasar</em> that "the endeavor need not have universal impact," but it must
        have documented potential for U.S.-level benefit.
      </p>
      <p>
        The key word is <em>documented</em>. Generic assertions ("AI is critical for the U.S.")
        do not establish national importance. Specific citations to federal programs, national
        strategy documents, or congressional mandates do.
      </p>

      <h2>How adjudicators evaluate prong 1</h2>
      <p>
        USCIS adjudicators assess prong 1 by looking for three elements:
      </p>
      <ol>
        <li>A specific proposed endeavor (not just a field or discipline)</li>
        <li>Documentation that the specific endeavor — not just the field generally — has national-level implications</li>
        <li>A recognizable federal or institutional record that corroborates the national-importance claim</li>
      </ol>
      <p>
        The third element is where most petitions fail. Saying "AI has national importance" is
        obvious and not contested — but it doesn't establish that your specific proposed endeavor
        has national importance. The documentation needs to connect your specific work to a
        specific documented federal priority.
      </p>

      <h2>The federal priority map by field</h2>
      <p>
        Below is a field-by-field map of the federal documents most commonly used to anchor
        prong-1 national-importance arguments. These are not the only valid anchors, but they
        are the ones with the clearest official standing.
      </p>

      <div className="not-prose overflow-x-auto my-6">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left py-2 pr-4 font-semibold text-text-primary">Field</th>
              <th className="text-left py-2 font-semibold text-text-primary">Primary federal anchors</th>
            </tr>
          </thead>
          <tbody className="text-text-secondary">
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4 align-top">Artificial intelligence / ML</td><td className="py-2">NSTC CET List (AI/ML); National AI Initiative (NAIIA); National AI Research Resource; Executive Order 13859/14110</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4 align-top">Semiconductors / hardware</td><td className="py-2">CHIPS and Science Act (2022); NSTC CET List (semiconductors); National Semiconductor Technology Center (NSTC)</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4 align-top">Quantum computing / sensing</td><td className="py-2">National Quantum Initiative Act; NSTC CET List (quantum); NSF Quantum Leap Challenge Institutes</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4 align-top">Cybersecurity</td><td className="py-2">National Cybersecurity Strategy (2023); NIST Cybersecurity Framework; CISA strategic plan; Executive Order 14028</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4 align-top">Biotechnology / genomics</td><td className="py-2">NSTC CET List (biotech); National Biotechnology and Biomanufacturing Initiative (EO 14081); NIH Strategic Plans by institute</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4 align-top">Oncology / cancer research</td><td className="py-2">Cancer Moonshot 2.0 (White House); NCI Strategic Plan; American Cancer Plan (NCI)</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4 align-top">Climate / energy</td><td className="py-2">DOE Energy Earthshots; Inflation Reduction Act clean-energy provisions; NSTC CET List (advanced energy); DOE Long-Duration Storage Shot</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4 align-top">Advanced manufacturing</td><td className="py-2">Manufacturing USA network priorities; NSTC CET List (advanced manufacturing); National Strategy for Advanced Manufacturing</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4 align-top">Space technology</td><td className="py-2">National Space Policy (2020); NASA Strategic Plan; NSTC CET List (space technologies)</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4 align-top">Healthcare access / medicine</td><td className="py-2">HHS HPSA/MUA shortage designations; National Health Security Strategy; NIH health equity priority areas</td></tr>
            <tr className="border-b border-border-subtle"><td className="py-2 pr-4 align-top">Materials science</td><td className="py-2">NSTC CET List (advanced materials); Materials Genome Initiative; DOE Basic Energy Sciences priorities</td></tr>
            <tr><td className="py-2 pr-4 align-top">Education / workforce</td><td className="py-2">National STEM Education Strategic Plan; CHIPS workforce development provisions; NSF STEM workforce priorities</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Using the priority map correctly</h2>
      <p>
        The map above gives you the right documents to cite — but citing them alone is not enough.
        The argument needs to connect your specific proposed endeavor to a specific provision
        or priority within the document.
      </p>
      <p>
        For example: "My proposed work on [specific quantum error correction technique] directly
        advances the National Quantum Initiative's goal of maintaining U.S. leadership in
        quantum information science, specifically the NSF Quantum Leap Challenge Institute
        for Robust Quantum Simulation program's objective of developing fault-tolerant quantum
        computing architectures."
      </p>
      <p>
        That level of specificity — document name, program name, specific goal — is what turns
        a federal citation into a prong-1 argument. Vague reference to "quantum is a national
        priority" does not.
      </p>

      <h2>Fields not on the list</h2>
      <p>
        The table covers the highest-density NIW application fields, but NIW has been approved
        across dozens of other areas: public policy, environmental law, linguistics, social
        sciences, arts, architecture, and more. The principle is the same: find the specific
        federal document or program that establishes your field's national-priority status and
        connect your specific endeavor to a specific goal within it.
      </p>
      <p>
        If your field is not on the NSTC list, look for: congressional testimony citing the
        field as a national need, White House strategy documents, federal agency strategic plans,
        or documented public programs specifically funding work in your area.
      </p>

      <div className="not-prose my-8 rounded-xl bg-surface-subtle border border-border-default px-6 py-5">
        <p className="text-sm font-semibold text-text-primary mb-2">How strong is your prong-1 argument?</p>
        <p className="text-sm text-text-secondary mb-4">
          Our assessment asks about your specific field and proposed work, then maps it against
          federal priority documents to give you a prong-1 strength read before filing.
        </p>
        <Link href="/check" className="btn btn-primary text-sm">Check my prong-1 strength — free</Link>
      </div>

      <p>
        For how to write the proposed-endeavor statement that makes these connections, see{" "}
        <Link href="/articles/niw-proposed-endeavor">the proposed-endeavor statement guide</Link>.
        The <Link href="/eb2-niw-guide">EB-2 NIW guide</Link> covers all three prongs.
      </p>
      <p className="text-xs text-text-muted mt-8">Not legal advice. USCIS policy guidance changes; verify current standards at uscis.gov. Consult a qualified U.S. immigration attorney.</p>
    </div>
  );
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const ARTICLES: Article[] = [
  { meta: rfeResponseMeta, Body: RfeResponseBody },
  { meta: denialReasonsMeta, Body: DenialReasonsBody },
  { meta: noPhdMeta, Body: NoPhdBody },
  { meta: citationsMeta, Body: CitationsBody },
  { meta: recLettersMeta, Body: RecLettersBody },
  { meta: endeavorMeta, Body: EndeavorBody },
  { meta: timelineMeta, Body: TimelineBody },
  { meta: costMeta, Body: CostBody },
  { meta: physiciansMeta, Body: PhysiciansBody },
  { meta: prong1Meta, Body: Prong1Body },
];

export const ARTICLES_BY_SLUG = new Map(ARTICLES.map((a) => [a.meta.slug, a]));
