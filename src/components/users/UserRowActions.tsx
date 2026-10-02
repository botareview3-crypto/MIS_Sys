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
  const [modal, setModal] = useState<"reset" | "link" | "delete" | null>(null);
  const [resetLink, setResetLink] = useState("");
  const [copied, setCopied] = useState(false);
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

  async function generateLink() {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const res = await fetch(`/api/users/${userId}/reset-link`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "The reset link could not be generated.");
        setResetLink("");
      } else {
        setResetLink(data.resetLink);
      }
      setModal("link");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(resetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard unavailable - the link is still selectable as plain text.
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
        {isActive && (
          <button type="button" disabled={busy} onClick={generateLink} className="text-brand-600 hover:underline">
            Reset link
          </button>
        )}
        {role === "Technician" && !isSelf && (
          <button type="button" onClick={() => setModal("delete")} className="text-red-600 hover:underline">
            Delete
          </button>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="card w-full max-w-sm p-5">
            {modal === "link" ? (
              <>
                <h3 className="text-sm font-semibold text-stone-900">Reset link for {fullName}</h3>
                {error ? (
                  <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-stone-500">
                      Give this link to {fullName}. It expires in <strong>1 hour</strong>, works once, and replaces
                      any earlier link for this account.
                    </p>
                    <div className="mt-3 break-all rounded-md border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-xs text-stone-700">
                      {resetLink}
                    </div>
                    <button
                      type="button"
                      onClick={copyLink}
                      className="mt-2 rounded-md border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-600 hover:bg-brand-50"
                    >
                      {copied ? "\u2713 Copied!" : "Copy link"}
                    </button>
                    <p className="mt-2 text-xs text-amber-700">
                      Keep it private: anyone with this link can set a new password for this account.
                    </p>
                  </>
                )}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setModal(null);
                      setResetLink("");
                      setError("");
                    }}
                    className="btn-primary"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : modal === "reset" ? (
              <>
                <h3 className="text-sm font-semibold text-stone-900">Reset password for {fullName}</h3>
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
                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
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
                <h3 className="text-sm font-semibold text-stone-900">Delete {fullName}?</h3>
                <p className="mt-1 text-sm text-stone-500">
                  This deactivates the technician account and unassigns them from any devices. This mirrors the
                  original system: only Technician accounts can be deleted this way.
                </p>
                {error && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="rounded-lg px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100"
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
