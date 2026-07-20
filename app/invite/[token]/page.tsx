"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "accepting" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [caseId, setCaseId] = useState("");

  // Auto-accept if already logged in as attorney
  useEffect(() => {
    accept();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accept = async () => {
    setStatus("accepting");
    const res = await fetch(`/api/invite/${token}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setCaseId(data.caseId);
      setStatus("done");
      setTimeout(() => router.push(`/cases/${data.caseId}`), 1500);
    } else if (res.status === 401) {
      // Not logged in — send to login then back here
      router.push(`/login?from=/invite/${token}`);
    } else {
      setError(data.error || "Something went wrong");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="card max-w-sm space-y-3 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-success-bg">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-success-text"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg>
          </div>
          <h1 className="font-serif text-2xl">You&apos;re in</h1>
          <p className="text-sm text-text-secondary">Case linked to your account. Redirecting...</p>
          <a href={`/cases/${caseId}`} className="btn btn-primary inline-block">
            Open case
          </a>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="card max-w-sm space-y-3 text-center">
          <h1 className="font-serif text-2xl">Invite issue</h1>
          <p className="text-sm text-danger-fill">{error}</p>
          <p className="text-xs text-text-muted">
            The link may have expired (7 days) or already been used. Ask your client to generate a new one.
          </p>
          <Link href="/cases" className="btn btn-secondary inline-block">
            Go to cases
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card max-w-sm space-y-3 text-center">
        <h1 className="font-serif text-2xl">Accepting invite...</h1>
        <p className="text-sm text-text-muted">Linking case to your account.</p>
      </div>
    </div>
  );
}
