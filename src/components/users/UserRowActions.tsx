"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function UserRowActions({
  userId,
  fullName,
  role,
  isActive,
  isSelf,
}: {
  userId: number;
  fullName: string;
  role: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"reset" | "delete" | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function toggleStatus() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${userId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isActive ? "deactivate" : "reactivate" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "The account status could not be updated.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitReset() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword, passwordConfirmation: confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "The password could not be updated.");
        return;
      }
      setModal(null);
      setNewPassword("");
      setConfirmPassword("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submitDelete() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "The technician could not be deleted.");
        return;
      }
      setModal(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 text-xs font-medium">
        <Link href={`/users/${userId}/edit`} className="text-brand-600 hover:underline">
          Edit
        </Link>
        {!isSelf && (
          <button type="button" disabled={busy} onClick={toggleStatus} className="text-brand-600 hover:underline">
            {isActive ? "Deactivate" : "Reactivate"}
          </button>
        )}
        <button type="button" onClick={() => setModal("reset")} className="text-brand-600 hover:underline">
          Reset password
        </button>
        {role === "Technician" && !isSelf && (
          <button type="button" onClick={() => setModal("delete")} className="text-red-600 hover:underline">
            Delete
          </button>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="card w-full max-w-sm p-5">
            {modal === "reset" ? (
              <>
                <h3 className="text-sm font-semibold text-slate-900">Reset password for {fullName}</h3>
                {error && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                <input
                  type="password"
                  className="input mt-3"
                  placeholder="New password (min 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <input
                  type="password"
                  className="input mt-2"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button type="button" disabled={busy} onClick={submitReset} className="btn-primary">
                    {busy ? "Saving…" : "Reset password"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-slate-900">Delete {fullName}?</h3>
                <p className="mt-1 text-sm text-slate-500">
                  This deactivates the technician account and unassigns them from any devices. This mirrors the
                  original system: only Technician accounts can be deleted this way.
                </p>
                {error && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={submitDelete}
                    className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {busy ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
