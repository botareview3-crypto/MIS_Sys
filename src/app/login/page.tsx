"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_LEGEND = [
  { label: "Received", color: "bg-status-received" },
  { label: "Diagnosing", color: "bg-status-diagnosing" },
  { label: "Repairing", color: "bg-status-repairing" },
  { label: "Ready", color: "bg-status-ready" },
  { label: "Delivered", color: "bg-status-delivered" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-stone-50">
      {/* Left: brand panel. The one bold moment in the whole app. */}
      <div className="relative hidden w-[42%] shrink-0 overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-between lg:p-10">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full text-white/[0.07]"
          viewBox="0 0 400 800"
          fill="none"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          <path
            d="M-20 120 H140 V260 H320 V120 H460 M-20 420 H90 V520 H260 V680 H460 M-20 620 H200 V560 H340"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="140" cy="120" r="4" fill="currentColor" />
          <circle cx="320" cy="260" r="4" fill="currentColor" />
          <circle cx="90" cy="420" r="4" fill="currentColor" />
          <circle cx="260" cy="680" r="4" fill="currentColor" />
          <circle cx="200" cy="620" r="4" fill="currentColor" />
        </svg>

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-500 font-display text-sm font-bold text-white">
            A
          </div>
          <strong className="font-display text-sm font-semibold text-white">MIS Repair</strong>
        </div>

        <div className="relative">
          <h1 className="font-display text-3xl font-medium leading-tight text-white">
            Every device,
            <br />
            one clear status.
          </h1>
          <p className="mt-3 max-w-xs text-sm text-ink-muted">
            From intake to delivery, the workbench tracks each repair through five stages so
            nothing sits unattended.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {STATUS_LEGEND.map((s) => (
              <li
                key={s.label}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-ink-muted"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${s.color}`} aria-hidden />
                {s.label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-ink-muted/70">Device repair tracking and workflow management</p>
      </div>

      {/* Right: sign-in form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-500 font-display text-sm font-bold text-white">
                A
              </div>
              <strong className="font-display text-sm font-semibold text-ink">MIS Repair</strong>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="font-display text-xl font-medium text-ink">Sign in</h2>
            <p className="mt-1 text-sm text-stone-500">Use your workbench credentials to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-stone-700">
                Username
              </label>
              <input
                id="username"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-stone-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <a href="/forgot-password" className="block text-center text-sm text-brand-600 hover:underline">
              Forgot your password?
            </a>
          </form>
        </div>
      </div>
    </main>
  );
}
