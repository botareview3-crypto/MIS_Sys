"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type CheckState =
  | { status: "checking" }
  | { status: "invalid"; message: string }
  | { status: "valid"; fullName: string }
  | { status: "success" };

function strengthLabel(pw: string): string {
  if (!pw) return "Enter a password";
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return ["Too weak", "Weak", "Fair", "Strong", "Very strong"][Math.min(score, 4)];
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [check, setCheck] = useState<CheckState>({ status: "checking" });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setCheck({ status: "invalid", message: "This reset link is invalid or has expired." });
      return;
    }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.valid) {
          setCheck({ status: "valid", fullName: data.fullName });
        } else {
          setCheck({ status: "invalid", message: data.message ?? "This reset link is invalid or has expired." });
        }
      })
      .catch(() => {
        if (!cancelled) setCheck({ status: "invalid", message: "Something went wrong. Please try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, passwordConfirmation: confirmation }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not update your password. Please try again.");
        return;
      }
      setCheck({ status: "success" });
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-semibold text-white">
            A
          </div>
          <h1 className="text-xl font-semibold text-slate-900">AUC MIS Repair Management</h1>
        </div>

        <div className="card space-y-4 p-6">
          {check.status === "checking" && <p className="text-sm text-slate-500">Checking your reset link...</p>}

          {check.status === "invalid" && (
            <>
              <h2 className="text-lg font-semibold text-slate-900">Link invalid</h2>
              <p className="text-sm text-slate-500">{check.message}</p>
              <a href="/forgot-password" className="btn-primary block w-full text-center">
                Request new link
              </a>
              <a href="/login" className="block text-center text-sm text-brand-600 hover:underline">
                ← Back to login
              </a>
            </>
          )}

          {check.status === "success" && (
            <>
              <h2 className="text-lg font-semibold text-slate-900">Password updated!</h2>
              <p className="text-sm text-slate-500">
                Your password has been changed successfully. You can now log in with your new password.
              </p>
              <a href="/login" className="btn-primary block w-full text-center">
                Go to login →
              </a>
            </>
          )}

          {check.status === "valid" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Set new password</h2>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50/60 px-3 py-1 text-xs font-semibold text-brand-700">
                  {check.fullName}
                </span>
              </div>

              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">
                  New password
                </label>
                <div className="flex gap-2">
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    maxLength={255}
                    autoComplete="new-password"
                    placeholder="Minimum 8 characters"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="shrink-0 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="text-xs text-slate-400">{strengthLabel(password)}</p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password_confirmation" className="text-sm font-medium text-slate-700">
                  Confirm new password
                </label>
                <input
                  id="password_confirmation"
                  type={showPw ? "text" : "password"}
                  className="input"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  minLength={8}
                  maxLength={255}
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
                  required
                />
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? "Updating..." : "Update password"}
              </button>

              <a href="/login" className="block text-center text-sm text-brand-600 hover:underline">
                ← Back to login
              </a>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
