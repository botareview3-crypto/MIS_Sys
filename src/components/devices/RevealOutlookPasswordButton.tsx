"use client";

import { useState } from "react";

/**
 * Ported from the `.credential-reveal` button + its handler in
 * assets/js/app.js (used on view-device.php). Behavior matches exactly:
 * "Show" always re-fetches (and re-audit-logs) the password from the
 * server; "Hide" is a pure client-side toggle back to bullets, no re-fetch.
 * A failed reveal shows the error message in place of the password and
 * leaves the button in the "Show" state so the next click retries.
 */
export function RevealOutlookPasswordButton({ deviceId }: { deviceId: number }) {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (visible) {
      setVisible(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/devices/${deviceId}/reveal-outlook-password`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Password could not be revealed.");
      setPassword(data.password);
      setVisible(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password could not be revealed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className={error ? "text-red-600" : "text-slate-700"}>
        {error || (visible && password ? password : "••••••••")}
      </span>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? "…" : visible ? "Hide" : "Show"}
      </button>
    </span>
  );
}
