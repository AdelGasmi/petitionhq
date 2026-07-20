"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

type TokenInfo = { name: string; email: string; role: string };

export default function UserInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [info, setInfo] = useState<TokenInfo | null>(null);
  const [tokenError, setTokenError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetch(`/api/invite/user/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) setTokenError(data.error ?? "Invalid link.");
        else setInfo(data);
      })
      .catch(() => setTokenError("Could not validate this link."));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setFormError("Passwords do not match."); return; }
    if (password.length < 8) { setFormError("Password must be at least 8 characters."); return; }

    setSubmitting(true);
    setFormError("");

    const res = await fetch(`/api/invite/user/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) { setFormError(data.error ?? "Something went wrong."); return; }

    // Redirect based on role
    router.push(data.role === "admin" ? "/admin" : "/cases");
  };

  if (tokenError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-subtle p-4">
        <div className="card w-full max-w-sm space-y-4 text-center">
          <h1 className="font-serif text-2xl">Invite link issue</h1>
          <p className="text-sm text-danger-fill">{tokenError}</p>
          <p className="text-xs text-text-muted">
            Ask your admin to send a new invite link.
          </p>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-subtle">
        <p className="text-sm text-text-muted">Validating link…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-subtle p-4">
      <div className="card w-full max-w-sm space-y-6">
        <div>
          <h1 className="font-serif text-2xl tracking-tight">Set your password</h1>
          <p className="mt-1 text-sm text-text-muted">
            Welcome, {info.name}. Create a password to activate your account.
          </p>
        </div>

        <div className="rounded-lg bg-surface-muted px-4 py-3 text-sm">
          <div className="text-text-muted">Signing in as</div>
          <div className="font-medium text-text-primary">{info.email}</div>
          <div className="mt-0.5 text-xs capitalize text-text-muted">{info.role}</div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary">New password</label>
            <input
              type="password"
              className="input mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">Confirm password</label>
            <input
              type="password"
              className="input mt-1"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="Same password again"
            />
          </div>

          {formError && <p className="text-sm text-danger-fill">{formError}</p>}

          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? "Activating…" : "Activate account"}
          </button>
        </form>
      </div>
    </div>
  );
}
