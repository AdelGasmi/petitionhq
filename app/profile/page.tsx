import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { ProfileForm } from "@/components/ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  let session;
  try { session = await requireSession(); }
  catch { redirect("/login"); }

  const user = await findUserById(session.userId);
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-2">
      <h1 className="font-serif text-3xl tracking-tight">Profile & settings</h1>
      <p className="text-text-muted text-sm mb-6">Manage your personal details and security settings.</p>
      <ProfileForm
        name={user.name}
        phone={user.phone}
        email={user.email}
        role={user.role}
        createdAt={user.createdAt}
        hasPassword={!!user.passwordHash}
      />

      {user.selfPetitionerBeta && (
        <Link href="/profile/drafting-rules" className="card card-hover flex items-center justify-between gap-4">
          <div>
            <div className="font-medium text-text-primary">Drafting rules & standards</div>
            <div className="text-sm text-text-muted">Set your own tone, must-includes, and things to avoid for AI drafting on your case.</div>
          </div>
          <span className="text-text-muted">→</span>
        </Link>
      )}
    </div>
  );
}
