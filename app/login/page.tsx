"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

declare global {
  interface Window { turnstile?: { render: (el: string | HTMLElement, opts: Record<string, unknown>) => string; reset: (id: string) => void } }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only trust an explicit ?from= (set when an auth-gated page bounced the
  // user here). The plain "Log in" header link passes no `from` at all, so
  // it must not silently default to an attorney-only destination — that
  // defaulting bug is exactly why self-petitioner beta applicants had no
  // working login entry point on the marketing site.
  const explicitFrom = searchParams.get("from");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileReady, setTurnstileReady] = useState(!TURNSTILE_SITE_KEY); // ready immediately if no key
  const turnstileToken = useRef<string>("");
  const turnstileWidgetId = useRef<string>("");
  const turnstileContainer = useRef<HTMLDivElement>(null);

  const initTurnstile = useCallback(() => {
    if (!TURNSTILE_SITE_KEY || !window.turnstile || !turnstileContainer.current) return;
    if (turnstileWidgetId.current) return;
    turnstileWidgetId.current = window.turnstile.render(turnstileContainer.current, {
      sitekey: TURNSTILE_SITE_KEY,
      size: "invisible",
      callback: (token: string) => {
        turnstileToken.current = token;
        setTurnstileReady(true);
      },
      "error-callback": () => {
        turnstileToken.current = "__turnstile_failed__";
        setTurnstileReady(true); // fail-open: let the server decide
      },
      "expired-callback": () => {
        turnstileToken.current = "";
        setTurnstileReady(false); // token expired, wait for auto-refresh
      },
    });
  }, []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    if (window.turnstile) { initTurnstile(); return; }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__onTurnstileLoad";
    script.async = true;
    (window as unknown as Record<string, unknown>).__onTurnstileLoad = initTurnstile;
    document.head.appendChild(script);
    return () => { delete (window as unknown as Record<string, unknown>).__onTurnstileLoad; };
  }, [initTurnstile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // If Turnstile hasn't resolved yet, wait up to 4s before proceeding
    if (TURNSTILE_SITE_KEY && !turnstileToken.current) {
      await new Promise<void>((resolve) => {
        const start = Date.now();
        const poll = setInterval(() => {
          if (turnstileToken.current || Date.now() - start > 4000) {
            clearInterval(poll);
            resolve();
          }
        }, 100);
      });
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken: turnstileToken.current || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.requiresVerification) {
          router.push(`/verify?userId=${data.userId}`);
          return;
        }
        setError(data.error ?? "Login failed.");
        if (turnstileWidgetId.current && window.turnstile) window.turnstile.reset(turnstileWidgetId.current);
        return;
      }
      const destination =
        data.role === "admin" ? "/admin"
        : explicitFrom ? explicitFrom
        : data.role === "attorney" ? "/network/dashboard"
        : "/cases";
      router.push(destination);
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
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-white">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="1" width="13" height="17" rx="1.5" stroke="white" strokeWidth="1.5"/>
            <path d="M6 6h7M6 9h7M6 12h4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="17" cy="16" r="4" fill="#1c1917" stroke="white" strokeWidth="1.5"/>
            <path d="M15 16l1.5 1.5L19 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="mt-4 font-serif text-3xl tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-text-muted">PetitionHQ</p>
      </div>

      <form onSubmit={submit} className="card space-y-4">
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
        <div>
          <label className="block text-sm font-medium text-text-secondary">Password</label>
          <input
            type="password"
            className="input mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-sm text-danger-fill">{error}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={loading || (!!TURNSTILE_SITE_KEY && !turnstileReady)}>
          {loading ? "Signing in…" : (TURNSTILE_SITE_KEY && !turnstileReady) ? "Verifying…" : "Sign in"}
        </button>
        <div className="text-center">
          <Link href="/forgot-password" className="text-xs text-text-secondary underline hover:text-text-primary">
            Forgot password?
          </Link>
        </div>
        <div className="flex items-center justify-between text-xs text-text-muted">
          <Link href="/signup" className="text-text-secondary underline hover:text-text-primary">
            Create account
          </Link>
          <a href="/setup" className="hover:text-text-secondary">
            First-time setup
          </a>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
