"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteDeviceButton({ deviceId, jobId }: { deviceId: number; jobId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (reason.trim().length < 10 || reason.trim().length > 500) {
      setError("Please provide a deletion reason between 10 and 500 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "The device could not be deleted.");
        return;
      }
      router.push("/devices");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="card w-full max-w-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900">Delete device {jobId}?</h3>
        <p className="mt-1 text-sm text-slate-500">
          This permanently removes the device and its operational records. Audit history is preserved.
        </p>
        {error && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <textarea
          className="input mt-3"
          rows={3}
          placeholder="Reason for deletion (10-500 characters)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
