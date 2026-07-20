import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { readCase } from "@/lib/db";
import { getSession, canAccessCase, canDraftCase } from "@/lib/auth";
import { getForm } from "@/forms";
import { LetterEditor } from "@/components/LetterEditor";

export const dynamic = "force-dynamic";

export default async function LetterPage({
  params,
}: {
  params: Promise<{ id: string; letterId: string }>;
}) {
  const { id, letterId } = await params;

  const [c, session] = await Promise.all([readCase(id), getSession()]);
  if (!c) notFound();
  if (!session) redirect("/login");
  if (!canAccessCase(session, c)) redirect("/cases");
  const isBetaDrafter = session.role === "applicant" && (await canDraftCase(session, c));
  if (session.role === "applicant" && !isBetaDrafter) redirect(`/cases/${id}`);

  const form = getForm(c.formId);
  if (!form) notFound();

  const letter = c.letters[letterId];
  if (!letter) notFound();

  const letterReq = form.letters.find((l) => l.id === letter.requirementId);
  if (!letterReq) notFound();

  const narrative = letterReq.kind === "petition-letter"
    ? form.narratives?.find((n) => n.id === letterReq.id)
    : undefined;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/cases/${id}`}
          className="text-sm text-text-muted hover:text-text-primary"
        >
          ← Back to case
        </Link>
      </div>

      <header>
        <div className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {letterReq.title}
        </div>
        <h1 className="mt-1 font-serif text-3xl tracking-tight">
          {letter.recommender.name
            || (letterReq.kind === "petition-letter" ? letterReq.title : "New letter")}
        </h1>
        {letter.recommender.institution && (
          <p className="mt-1 text-text-secondary">
            {letter.recommender.title
              ? `${letter.recommender.title}, `
              : ""}
            {letter.recommender.institution}
          </p>
        )}
      </header>

      <LetterEditor
        initialCase={c}
        initialLetter={letter}
        letterReq={letterReq}
        currentUserId={session.userId}
        currentUserRole={session.role}
        narrative={narrative}
        hideAttorneyChrome={isBetaDrafter}
      />
    </div>
  );
}
