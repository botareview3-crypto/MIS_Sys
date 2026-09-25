"use client";

import { useState } from "react";

type Result =
  | { found: true; fullName: string; resetLink: string }
  | { found: false };

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setResult(data);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable — link is still selectable as plain text.
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
          <p className="mt-1 text-sm text-slate-500">Account recovery</p>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit} className="card space-y-4 p-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Forgot password?</h2>
              <p className="mt-1 text-sm text-slate-500">
                Enter your username and a secure reset link will be generated for an administrator to share with you.
              </p>
            </div>

            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-slate-700">
                Your username
              </label>
              <input
                id="username"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="Enter your system username"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Generating..." : "Generate reset link"}
            </button>

            <a href="/login" className="block text-center text-sm text-brand-600 hover:underline">
              ← Back to login
            </a>
          </form>
        ) : (
          <div className="card space-y-4 p-6">
            {result.found ? (
              <>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Reset link generated</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    A secure password reset link has been generated for <strong>{result.fullName}</strong>. Copy the
                    link below and open it in your browser, or ask your system administrator to share it with you.
                  </p>
                </div>

                <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
                    Your password reset link
                  </p>
                  <div className="break-all rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700">
                    {result.resetLink}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyLink(result.resetLink)}
                    className="mt-2 rounded-md border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                  >
                    {copied ? "✓ Copied!" : "Copy link"}
                  </button>
                  <p className="mt-2 text-xs text-slate-500">
                    ⏱ This link expires in <strong>1 hour</strong> and can only be used once.
                  </p>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Keep this link private. Anyone with this link can reset the password for this account.
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-900">Request received</h2>
                <p className="text-sm text-slate-500">If a matching active account was found, a reset link has been generated.</p>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <strong>No account found or account is inactive.</strong> Please check your username and try again,
                  or contact your system administrator to reset your password manually via Manage Users.
                </div>
              </>
            )}

            <a href="/login" className="block text-center text-sm text-brand-600 hover:underline">
              ← Back to login
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
