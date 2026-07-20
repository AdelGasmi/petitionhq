"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { PublicUser } from "@/lib/users";

type NewUser = { name: string; email: string; password: string; role: "admin" | "attorney" | "applicant" };

export default function UsersPage() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewUser>({ name: "", email: "", password: "", role: "applicant" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Attorneys use the invite flow; other roles get a manual password
  const useInviteFlow = form.role === "attorney";

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    if (useInviteFlow) {
      // Send magic-link invite
      const res = await fetch("/api/admin/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, name: form.name, role: form.role }),
      });
      const data = await res.json();
      setCreating(false);
      if (!res.ok) { setError(data.error ?? "Failed to send invite."); return; }
      setSuccess(`Invite sent to ${form.email}. They'll receive a link to set their own password.`);
    } else {
      // Manual account creation for admin / applicant
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setCreating(false);
      if (!res.ok) { setError(data.error ?? "Failed to create user."); return; }
      setSuccess(`Account created for ${form.name}. Share their credentials with them directly.`);
    }

    setForm({ name: "", email: "", password: "", role: "applicant" });
    setShowForm(false);
    load();
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete account for ${name}? This cannot be undone.`)) return;
    await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-text-muted">
            Admins see all cases. Attorneys see their assigned cases. Applicants see only their own.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm((v) => !v); setError(""); setSuccess(""); }}>
          {showForm ? "Cancel" : "Add user"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="card space-y-4">
          <h2 className="font-serif text-lg">
            {useInviteFlow ? "Invite attorney" : "Create account"}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary">Name</label>
              <input
                className="input mt-1"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary">Email</label>
              <input
                type="email"
                className="input mt-1"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                placeholder="attorney@lawfirm.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary">Role</label>
              <select
                className="select mt-1"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as NewUser["role"] }))}
              >
                <option value="applicant">Applicant</option>
                <option value="attorney">Attorney</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {!useInviteFlow && (
              <div>
                <label className="block text-sm font-medium text-text-secondary">Temporary password</label>
                <input
                  type="text"
                  className="input mt-1"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required={!useInviteFlow}
                  minLength={8}
                  placeholder="Share this with the user"
                />
              </div>
            )}
          </div>

          {useInviteFlow && (
            <p className="rounded-lg bg-info-bg px-4 py-3 text-sm text-info-text">
              An activation email will be sent to the attorney. They&apos;ll click a link to set their own password — no need to share credentials manually.
            </p>
          )}

          {error && <p className="text-sm text-danger-fill">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating
              ? (useInviteFlow ? "Sending invite…" : "Creating…")
              : (useInviteFlow ? "Send invite" : "Create account")}
          </button>
        </form>
      )}

      {success && (
        <div className="rounded border border-success-border bg-success-bg p-4 text-sm text-success-text">
          {success}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : (
        <div className="space-y-2">
          {users.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-title">No users yet</p>
              <p className="empty-state-body">Users will appear here once they sign up.</p>
            </div>
          ) : (
            users.map((u) => (
              <div key={u.id} className="card flex items-center justify-between gap-4">
                <Link href={`/admin/users/${u.id}`} className="min-w-0 flex-1 hover:opacity-70">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-sm text-text-muted">{u.email}</div>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`badge badge-role-${u.role}`}>
                    {u.role}
                  </span>
                  <Link href={`/admin/users/${u.id}`} className="text-xs text-text-muted hover:text-text-primary">
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="text-xs text-text-muted hover:text-danger-fill"
                    onClick={() => remove(u.id, u.name)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
