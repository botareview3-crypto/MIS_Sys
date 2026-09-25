"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = ["Admin", "Secondary Admin", "Reception", "Technician"] as const;

export function EditUserForm({
  userId,
  initial,
}: {
  userId: number;
  initial: { fullName: string; username: string; role: string };
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: initial.fullName,
    username: initial.username,
    role: initial.role as (typeof ROLES)[number],
  });
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "The user account could not be updated." });
        return;
      }
      setMessage({ type: "success", text: data.noChanges ? "No user changes were necessary." : "User updated successfully." });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Could not reach the server. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <input
        className="input"
        placeholder="Full name"
        value={form.fullName}
        onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
        required
      />
      <input
        className="input"
        placeholder="Username"
        value={form.username}
        onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
        required
      />
      <select
        className="input"
        value={form.role}
        onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as typeof form.role }))}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
