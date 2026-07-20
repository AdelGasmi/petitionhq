"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

declare global {
  interface Window { turnstile?: { render: (el: string | HTMLElement, opts: Record<string, unknown>) => string; reset: (id: string) => void } }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileReady, setTurnstileReady] = useState(!TURNSTILE_SITE_KEY);
  const turnstileToken = useRef<string>("");
  const turnstileWidgetId = useRef<string>("");
  const turnstileContainer = useRef<HTMLDivElement>(null);

  const initTurnstile = useCallback(() => {
    if (!TURNSTILE_SITE_KEY || !window.turnstile || !turnstileContainer.current) return;
    if (turnstileWidgetId.current) return;
    turnstileWidgetId.current = window.turnstile.render(turnstileContainer.current, {
      sitekey: TURNSTILE_SITE_KEY,
      size: "invisible",
      callback: (token: string) => { turnstileToken.current = token; setTurnstileReady(true); },
      "error-callback": () => { turnstileToken.current = "__turnstile_failed__"; setTurnstileReady(true); },
      "expired-callback": () => { turnstileToken.current = ""; setTurnstileReady(false); },
    });
  }, []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (window.turnstile) { initTurnstile(); return; }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__onTurnstileLoadFp";
    script.async = true;
    (window as unknown as Record<string, unknown>).__onTurnstileLoadFp = initTurnstile;
    document.head.appendChild(script);
    return () => { delete (window as unknown as Record<string, unknown>).__onTurnstileLoadFp; };
  }, [initTurnstile]);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(""); setInfo("");
    // Wait up to 4s for Turnstile to resolve before sending.
    if (TURNSTILE_SITE_KEY && !turnstileToken.current) {
      await new Promise<void>((resolve) => {
        const start = Date.now();
        const poll = setInterval(() => {
          if (turnstileToken.current || Date.now() - start > 4000) { clearInterval(poll); resolve(); }
        }, 100);
      });
    }
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: turnstileToken.current || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        if (turnstileWidgetId.current && window.turnstile) window.turnstile.reset(turnstileWidgetId.current);
        return;
      }
      setInfo(
        data._devCode
          ? `Dev mode — your reset code is ${data._devCode}`
          : "If an account exists for that email, we've sent a 6-digit reset code. Check your inbox.",
      );
      setStep("reset");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Could not reset password."); return; }
      if (data.suspended) { setError("Your password was reset, but this account is suspended. Contact support."); return; }
      router.push(data.role === "admin" ? "/admin" : "/cases");
      router.refresh();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm space-y-8 pt-16">
      <div ref={turnstileContainer} />
      <div className="text-center">
        <h1 className="font-serif text-3xl tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-text-muted">
          {step === "request"
            ? "Enter your email and we'll send you a 6-digit code."
            : "Enter the code we emailed and choose a new password."}
        </p>
      </div>

      {step === "request" ? (
        <form onSubmit={requestCode} className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary">Email</label>
            <input
              type="email"
              className="input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />
          </div>
          {error && <p className="text-sm text-danger-fill">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={loading || (!!TURNSTILE_SITE_KEY && !turnstileReady)}>
            {loading ? "Sending…" : (TURNSTILE_SITE_KEY && !turnstileReady) ? "Verifying…" : "Send reset code"}
          </button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="card space-y-4">
          {info && <p className="text-sm text-text-secondary">{info}</p>}
          <div>
            <label className="block text-sm font-medium text-text-secondary">6-digit code</label>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="input mt-1 text-center font-mono tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
              autoComplete="one-time-code"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary">New password</label>
            <input
              type="password"
              className="input mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <p className="mt-1 text-xs text-text-muted">At least 8 characters.</p>
          </div>
          {error && <p className="text-sm text-danger-fill">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={loading || code.length < 6 || password.length < 8}>
            {loading ? "Resetting…" : "Reset password & sign in"}
          </button>
          <button
            type="button"
            className="text-xs text-text-muted hover:text-text-secondary"
            onClick={() => { setStep("request"); setError(""); setInfo(""); setCode(""); setPassword(""); }}
          >
            ← Use a different email
          </button>
        </form>
      )}

      <p className="text-center text-xs text-text-muted">
        <Link href="/login" className="text-text-secondary underline hover:text-text-primary">Back to sign in</Link>
      </p>
    </div>
  );
}
