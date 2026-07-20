import { NextRequest, NextResponse } from "next/server";
import { searchInstitutions } from "@/lib/verification/ror";

export const dynamic = "force-dynamic";

/**
 * Institution typeahead for the assessment wizard. Proxies ROR search so the
 * applicant picks a canonical organization (and we persist its ROR ID) rather
 * than typing an acronym we'd have to guess at verification time.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const results = await searchInstitutions(q, 8);
  return NextResponse.json({ results });
}
