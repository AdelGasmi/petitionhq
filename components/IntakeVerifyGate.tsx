"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  token: string;
};

type Phase = "idle" | "sending" | "input" | "verifying";

export function IntakeVerifyGate({ token }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = useCallback(async () => {
    setPhase("sending");
    setError("");
    try {
      const res = await fetch(`/api/intake/${token}/send-code`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send code");
        setPhase("idle");
        return;
      }
      setMaskedEmail(data.maskedEmail);
      setPhase("input");
      setCooldown(60);
      // Auto-focus first input
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch {
      setError("Network error. Please try again.");
      setPhase("idle");
    }
  }, [token]);

  const verifyCode = useCallback(
    async (fullCode: string) => {
      setPhase("verifying");
      setError("");
      try {
        const res = await fetch(`/api/intake/${token}/verify-code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: fullCode }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Verification failed");
          if (data.expired) {
            setPhase("idle");
            setCode(["", "", "", "", "", ""]);
          } else {
            setPhase("input");
            setCode(["", "", "", "", "", ""]);
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
          }
          return;
        }
        // Success — reload the page to render the wizard
        router.refresh();
      } catch {
        setError("Network error. Please try again.");
        setPhase("input");
      }
    },
    [token, router]
  );

  const handleDigitChange = (index: number, value: string) => {
    // Only accept digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (digit && index === 5) {
      const full = next.join("");
      if (full.length === 6) {
        verifyCode(full);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 0) return;
    const next = [...code];
    for (let i = 0; i < text.length && i < 6; i++) {
      next[i] = text[i];
    }
    setCode(next);
    const focusIdx = Math.min(text.length, 5);
    inputRefs.current[focusIdx]?.focus();

    if (text.length === 6) {
      verifyCode(text);
    }
  };

  return (
    <div className="mx-auto max-w-md py-20 text-center space-y-6">
      {/* Lock icon */}
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
      </div>

      <div>
        <h1 className="font-serif text-2xl tracking-tight">Verify your identity</h1>
        <p className="mt-2 text-sm text-text-muted">
          {phase === "idle" || phase === "sending"
            ? "To protect your information, we need to verify you have access to the email your attorney used for this link."
            : `We sent a 6-digit code to ${maskedEmail}. Enter it below.`}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-2 text-sm text-danger-text">
          {error}
        </div>
      )}

      {(phase === "idle" || phase === "sending") && (
        <button
          onClick={sendCode}
          disabled={phase === "sending"}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {phase === "sending" ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sending...
            </>
          ) : (
            "Send verification code"
          )}
        </button>
      )}

      {(phase === "input" || phase === "verifying") && (
        <div className="space-y-4">
          {/* 6-digit code input */}
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={phase === "verifying"}
                className="h-14 w-11 rounded-lg border border-border-default bg-surface-card text-center font-mono text-2xl font-bold text-text-primary transition-colors focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary disabled:opacity-50"
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          {phase === "verifying" && (
            <p className="text-sm text-text-muted">Verifying...</p>
          )}

          {/* Resend */}
          <div className="text-sm text-text-muted">
            {cooldown > 0 ? (
              <span>Resend available in {cooldown}s</span>
            ) : (
              <button
                onClick={sendCode}
                className="text-text-secondary underline hover:text-text-primary"
              >
                Resend code
              </button>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-text-muted">
        Your attorney sent you this link. If you didn&apos;t expect it, please contact them directly.
      </p>
    </div>
  );
}
