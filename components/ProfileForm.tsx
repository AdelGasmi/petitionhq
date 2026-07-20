"use client";

import { useState } from "react";

type Props = {
  name: string;
  phone: string | null;
  email: string;
  role: string;
  createdAt: string;
  hasPassword: boolean;
};

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  function strength(pw: string) {
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }

  const colors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-lime-400", "bg-green-500"];
  const labels = ["Weak", "Fair", "Moderate", "Strong", "Very strong"];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== confirm) { setError("Passwords do not match."); return; }
    if (next.length < 8) { setError("Password must be at least 8 characters."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed."); return; }
      setOk(true);
      setOpen(false);
      setCurrent(""); setNext(""); setConfirm("");
    } finally {
      setSaving(false);
    }
  }

  const s = strength(next);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-stone-700">Password</div>
          <div className="text-sm text-stone-500">{hasPassword ? "••••••••" : "No password set (Google account)"}</div>
        </div>
        <button onClick={() => { setOpen(!open); setOk(false); setError(""); }}
          className="btn btn-secondary text-sm">
          {hasPassword ? "Change" : "Set password"}
        </button>
      </div>

      {ok && (
        <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Password updated successfully.
        </div>
      )}

      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg border border-stone-200 p-4">
          {hasPassword && (
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-600">Current password</label>
              <input type="password" value={current} onChange={e => setCurrent(e.target.value)}
                className="input w-full" placeholder="Current password" required />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">New password</label>
            <input type="password" value={next} onChange={e => setNext(e.target.value)}
              className="input w-full" placeholder="New password" required />
            {next && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${i < s ? colors[s - 1] : "bg-stone-200"}`} />
                  ))}
                </div>
                <div className="mt-1 text-xs text-stone-500">{labels[s - 1] ?? "Too short"}</div>
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Confirm new password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              className="input w-full" placeholder="Confirm password" required />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary text-sm">
              {saving ? "Saving…" : "Save password"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function ProfileForm({ name, phone, email, role, createdAt, hasPassword }: Props) {
  const [editName, setEditName] = useState(name);
  const [editPhone, setEditPhone] = useState(phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaved(false);
    if (!editName.trim()) { setError("Name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, phone: editPhone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed."); return; }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Account info */}
      <section className="card space-y-4">
        <h2 className="font-serif text-xl tracking-tight">Account information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Email</div>
            <div className="mt-1 text-sm text-stone-800">{email}</div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Role</div>
            <div className="mt-1">
              <span className={`badge badge-role-${role}`}>{role}</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Member since</div>
            <div className="mt-1 text-sm text-stone-800">
              {new Date(createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </div>
          </div>
        </div>
      </section>

      {/* Edit profile */}
      <section className="card">
        <h2 className="font-serif text-xl tracking-tight mb-4">Profile</h2>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Full name</label>
            <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
              className="input w-full" placeholder="Your name" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">Phone number</label>
            <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)}
              className="input w-full" placeholder="+1 555 000 0000" />
            <p className="mt-1 text-xs text-stone-500">Optional — used for call/SMS verification and attorney contact.</p>
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          {saved && <div className="text-sm text-green-700">Profile saved.</div>}
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>

      {/* Password */}
      <section className="card">
        <h2 className="font-serif text-xl tracking-tight mb-4">Security</h2>
        <PasswordSection hasPassword={hasPassword} />
      </section>
    </div>
  );
}
