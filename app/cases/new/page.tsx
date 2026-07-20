import { redirect } from "next/navigation";
import Link from "next/link";
import { createCase } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listUsers } from "@/lib/users";
import { FORM_LIST, getForm } from "@/forms";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ formId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/cases");

  // Pricing-V3: /cases/new is admin-only (line 18 redirect).
  // Applicant cases are created from lead claims (network flow, $150 per claim).
  // Attorney-created cases go through the lead claim payment — no separate plan gate here.

  const { formId } = await searchParams;
  const form = formId ? getForm(formId) : null;

  const COMPANION_IDS = new Set(["i765", "i131"]);
  const sortedForms = [
    ...FORM_LIST.filter((f) => !COMPANION_IDS.has(f.id)),
    ...FORM_LIST.filter((f) => COMPANION_IDS.has(f.id)),
  ];

  const [applicants, attorneys] = session.role === "admin"
    ? await Promise.all([
        listUsers().then((u) => u.filter((u) => u.role === "applicant")),
        listUsers().then((u) => u.filter((u) => u.role === "attorney")),
      ])
    : [[], []];

  async function create(formData: FormData) {
    "use server";
    const sess = await getSession();
    if (!sess) redirect("/login");

    const formIdVal = String(formData.get("formId") || "");
    const titleVal = String(formData.get("title") || "My case").trim();
    const f = getForm(formIdVal);
    if (!f) throw new Error("Invalid form");

    const ownerId = sess.role === "admin"
      ? String(formData.get("ownerId") || "").trim() || undefined
      : sess.userId;
    const attorneyId = sess.role === "admin"
      ? String(formData.get("attorneyId") || "").trim() || undefined
      : undefined;

    const c = await createCase({ formId: formIdVal, title: titleVal, ownerId, attorneyId });
    logActivity({ actor: sess, caseId: c.id, caseTitle: c.title, action: "case.created", detail: formIdVal });
    // Applicants starting an NIW case go through guided intake first
    const goToIntake = formIdVal === "i140-niw" && sess.role === "applicant";
    redirect(goToIntake ? `/cases/${c.id}/intake` : `/cases/${c.id}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link href="/cases" className="text-sm text-text-muted hover:text-text-primary">← Cases</Link>
        <h1 className="mt-2 font-serif text-3xl tracking-tight">Start a new case</h1>
      </div>

      <form action={create} className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Petition type</label>
          <select name="formId" className="select" defaultValue={formId ?? ""} required>
            <option value="" disabled>Select a form…</option>
            {sortedForms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.formNumber} — {f.shortTitle}
                {COMPANION_IDS.has(f.id) ? " (companion filing)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Case title</label>
          <input
            name="title"
            className="input"
            required
            defaultValue={form ? `My ${form.shortTitle} petition` : ""}
            placeholder="e.g. My NIW petition"
          />
          <p className="mt-1 text-xs text-text-muted">For your reference only.</p>
        </div>

        {session.role === "admin" && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">Assign to client (optional)</label>
              <select name="ownerId" className="select" defaultValue="">
                <option value="">— No client —</option>
                {applicants.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Assign attorney (optional)</label>
              <select name="attorneyId" className="select" defaultValue="">
                <option value="">— No attorney —</option>
                {attorneys.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
          </>
        )}

        <button type="submit" className="btn btn-primary w-full">Create case →</button>
      </form>
    </div>
  );
}
