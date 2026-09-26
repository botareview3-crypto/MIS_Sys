"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SelfAssignButton({ deviceId }: { deviceId: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/repairs/${deviceId}/self-assign`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "This device could not be assigned to you.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="btn-primary bg-slate-700 hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? "Assigning…" : "Assign to Me"}
      </button>
      {error && <p className="max-w-[220px] text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
