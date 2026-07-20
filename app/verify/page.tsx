"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PinInput({ onComplete }: { onComplete: (code: string) => void }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const refs = [
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null),
  ];
  useEffect(() => { refs[0].current?.focus(); }, []); // eslint-disable-line

  const update = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...digits]; next[idx] = digit; setDigits(next);
    if (digit && idx < 5) refs[idx + 1].current?.focus();
    const code = next.join(""); if (code.length === 6) onComplete(code);
  };
  const handleKey = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) refs[idx - 1].current?.focus();
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!p) return; e.preventDefault();
    const next = [...digits]; p.split("").forEach((d, i) => { next[i] = d; }); setDigits(next);
    refs[Math.min(p.length, 5)].current?.focus();
    if (p.length === 6) onComplete(p);
  };
  return (
    <div className="flex gap-3 justify-center">
      {digits.map((d, i) => (
        <input key={i} ref={refs[i]} type="text" inputMode="numeric" maxLength={1} value={d}
          onChange={(e) => update(i, e.target.value)} onKeyDown={(e) => handleKey(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          className="h-14 w-11 rounded-xl border-2 border-border-default text-center text-xl font-semibold text-text-primary transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary" />
      ))}
    </div>
  );
}

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const userId = params.get("userId") ?? "";

  const [channel, setChannel] = useState<"email" | "call" | "sms" | null>(null);
  const [maskedTarget, setMaskedTarget] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCountdown]);

  if (!userId) {
    return (
      <div className="mx-auto max-w-sm pt-16">
        <div className="card space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-muted">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <h2 className="font-serif text-xl">Session expired</h2>
          <p className="text-sm text-text-muted">We couldn&apos;t find your verification session. Please sign in again to continue.</p>
          <a href="/login" className="btn btn-primary inline-block text-sm">Back to sign in</a>
        </div>
      </div>
    );
  }

  const sendCode = async (ch: "email" | "call" | "sms") => {
    setChannel(ch); setSendLoading(true); setSendError("");
    const res = await fetch("/api/auth/verify/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, channel: ch }),
    });
    const data = await res.json(); setSendLoading(false);
    if (!res.ok) { setSendError(data.error ?? "Failed to send code."); return; }
    setMaskedTarget(data.maskedTarget); setCodeSent(true); setResendCountdown(60);
    if (data._devCode) setDevCode(data._devCode);
  };

  const checkPin = async (code: string) => {
    setPinLoading(true); setPinError("");
    const res = await fetch("/api/auth/verify/check", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, code }),
    });
    const data = await res.json(); setPinLoading(false);
    if (!res.ok) { setPinError(data.error ?? "Incorrect code."); return; }
    if (data.role === "admin") router.push("/admin");
    else if (data.needsOnboarding) router.push("/onboarding");
    else router.push("/cases");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-sm space-y-8 pt-16">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-white">
          <span className="text-sm font-semibold">US</span>
        </div>
        <h1 className="mt-4 font-serif text-3xl tracking-tight">Verify your account</h1>
        <p className="mt-1 text-sm text-text-muted">One more step to activate your account</p>
      </div>

      {!codeSent ? (
        <div className="card space-y-4">
          <p className="text-sm text-text-secondary">How would you like to receive your code?</p>
          <div className="space-y-3">
            <button onClick={() => sendCode("email")} disabled={sendLoading}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-border-default px-4 py-3 text-left hover:border-border-strong hover:bg-surface-subtle disabled:opacity-50">
              <span className="font-medium text-text-primary text-sm">Email code</span>
            </button>
            <button onClick={() => sendCode("call")} disabled={sendLoading}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-border-default px-4 py-3 text-left hover:border-border-strong hover:bg-surface-subtle disabled:opacity-50">
              <span className="font-medium text-text-primary text-sm">Phone call</span>
            </button>
            <button onClick={() => sendCode("sms")} disabled={sendLoading}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-border-default px-4 py-3 text-left hover:border-border-strong hover:bg-surface-subtle disabled:opacity-50">
              <span className="font-medium text-text-primary text-sm">Text message</span>
            </button>
          </div>
          {sendError && <p className="text-sm text-danger-fill">{sendError}</p>}
        </div>
      ) : (
        <div className="card space-y-6">
          <div className="text-center">
            <p className="text-sm text-text-muted">
              {channel === "email" && `Code sent to ${maskedTarget}`}
              {channel === "call"  && `Calling ${maskedTarget} with your code`}
              {channel === "sms"   && `Text sent to ${maskedTarget}`}
            </p>
          </div>
          {devCode && (
            <div className="rounded-lg bg-warning-bg border border-warning-border px-4 py-2.5 text-center">
              <p className="text-xs font-medium text-warning-text uppercase tracking-wider mb-1">Dev mode — your code</p>
              <p className="font-mono text-2xl font-bold tracking-widest text-warning-text">{devCode}</p>
            </div>
          )}
          <PinInput onComplete={checkPin} />
          {pinLoading && <p className="text-center text-sm text-text-muted">Verifying…</p>}
          {pinError   && <p className="text-center text-sm text-danger-fill">{pinError}</p>}
          <div className="flex justify-between text-sm">
            <button onClick={() => { setCodeSent(false); setPinError(""); }}
              className="text-text-muted hover:text-text-secondary">← Back</button>
            <button onClick={() => sendCode(channel!)} disabled={resendCountdown > 0}
              className="text-text-secondary underline hover:text-text-primary disabled:text-text-muted disabled:no-underline">
              {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return <Suspense><VerifyForm /></Suspense>;
}
