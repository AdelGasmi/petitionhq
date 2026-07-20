"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Setup failed.");
        if (res.status === 403) {
          router.push("/login");
          return;
        }
        return;
      }
      router.push("/cases");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm space-y-8 pt-16">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-white">
          <span className="text-sm font-semibold">US</span>
        </div>
        <h1 className="mt-4 font-serif text-3xl tracking-tight">Set up your account</h1>
        <p className="mt-1 text-sm text-text-muted">
          Create the first attorney account. This page is only available once.
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary">Your name</label>
          <input
            type="text"
            className="input mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            placeholder="Jane Smith"
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
            placeholder="jane@lawfirm.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary">Password</label>
          <input
            type="password"
            className="input mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <p className="mt-1 text-xs text-text-muted">Minimum 8 characters.</p>
        </div>
        {error && <p className="text-sm text-danger-fill">{error}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create attorney account"}
        </button>
      </form>
    </div>
  );
}
