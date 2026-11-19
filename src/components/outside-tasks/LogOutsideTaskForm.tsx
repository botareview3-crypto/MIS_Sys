"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogOutsideTaskForm({ issues }: { issues: readonly string[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ customerName: "", issue: "", notes: "" });
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/outside-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "The task could not be saved." });
        return;
      }
      setForm({ customerName: "", issue: "", notes: "" });
      setMessage({ type: "success", text: "Task logged. The date and time were added automatically." });
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

      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">Customer name</label>
        <input
          className="input"
          placeholder="Customer name"
          value={form.customerName}
          onChange={(e) => set("customerName", e.target.value)}
          maxLength={150}
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">Issue</label>
        <select className="input" value={form.issue} onChange={(e) => set("issue", e.target.value)} required>
          <option value="" disabled>
            Select an issue…
          </option>
          {issues.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-stone-500">Notes (optional)</label>
        <textarea
          className="input min-h-[88px]"
          placeholder="Anything worth remembering about this job"
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          maxLength={2000}
        />
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? "Saving…" : "Log task"}
      </button>
    </form>
  );
}
