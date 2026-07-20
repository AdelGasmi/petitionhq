"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  user: { id: string; name: string; email: string; role: string };
};

export function UserEditForm({ user }: Props) {
  const router = useRouter();
  const [name, setName]   = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole]   = useState(user.role);
  const [password, setPassword] = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const body: Record<string, string> = {};
    if (name !== user.name)   body.name  = name;
    if (email !== user.email) body.email = email;
    if (role !== user.role)   body.role  = role;
    if (password.trim())      body.password = password.trim();

    if (Object.keys(body).length === 0) {
      setSaving(false);
      setSuccess("No changes.");
      return;
    }

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setError(data.error ?? "Update failed."); return; }

    setSuccess("Saved.");
    setPassword("");
    router.refresh();
  };

  return (
    <form onSubmit={save} className="card space-y-4">
      <h2 className="font-serif text-lg">Edit account</h2>

      <div>
        <label className="block text-sm font-medium text-text-secondary">Name</label>
        <input
          className="input mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary">Email</label>
        <input
          type="email"
          className="input mt-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary">Role</label>
        <select
          className="input mt-1"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="applicant">Applicant</option>
          <option value="attorney">Attorney</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary">
          Reset password
        </label>
        <input
          type="text"
          className="input mt-1"
          placeholder="Leave blank to keep current password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-text-muted">
          Min 8 characters. Share the new password with the user directly.
        </p>
      </div>

      {error   && <p className="text-sm text-danger-fill">{error}</p>}
      {success && <p className="text-sm text-success-text">{success}</p>}

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
