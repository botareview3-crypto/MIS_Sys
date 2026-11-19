"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLES = ["Admin", "Secondary Admin", "Reception", "Technician"] as const;

export function AddUserForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    username: "",
    password: "",
    passwordConfirmation: "",
    role: "Technician" as (typeof ROLES)[number],
    isActive: true,
  });
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
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "The new user account could not be created." });
        return;
      }
      router.push("/users");
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
        onChange={(e) => set("fullName", e.target.value)}
        required
      />
      <input
        className="input"
        placeholder="Username (letters, numbers, . _ -)"
        value={form.username}
        onChange={(e) => set("username", e.target.value)}
        required
      />
      <input
        type="password"
        className="input"
        placeholder="Password (min 8 characters)"
        value={form.password}
        onChange={(e) => set("password", e.target.value)}
        required
      />
      <input
        type="password"
        className="input"
        placeholder="Confirm password"
        value={form.passwordConfirmation}
        onChange={(e) => set("passwordConfirmation", e.target.value)}
        required
      />
      <select className="input" value={form.role} onChange={(e) => set("role", e.target.value as typeof form.role)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
        Active immediately
      </label>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Creating…" : "Create user"}
      </button>
    </form>
  );
}
