"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Person = { id: number; fullName: string; role?: string };

export function AssignTechnicianForm({
  deviceId,
  technicians,
  secondaryAdmins,
  currentTechnicianId,
  currentSecondaryAdminId,
}: {
  deviceId: number;
  technicians: Person[];
  secondaryAdmins: Person[];
  currentTechnicianId: number | null;
  currentSecondaryAdminId: number | null;
}) {
  const router = useRouter();
  const [technicianId, setTechnicianId] = useState(currentTechnicianId ?? 0);
  const [secondaryAdminId, setSecondaryAdminId] = useState(currentSecondaryAdminId ?? 0);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/repairs/${deviceId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technicianId, secondaryAdminId: secondaryAdminId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "The technician assignment could not be saved." });
        return;
      }
      setMessage({
        type: "success",
        text: data.technicianName
          ? `Device successfully assigned to ${data.technicianName}.`
          : "Admin assignment saved without a technician.",
      });
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
        <label className="mb-1 block text-sm font-medium text-slate-700">Technician</label>
        <select className="input" value={technicianId} onChange={(e) => setTechnicianId(Number(e.target.value))}>
          <option value={0}>Unassigned</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName} ({t.role})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Additional Admin (optional)</label>
        <select
          className="input"
          value={secondaryAdminId}
          onChange={(e) => setSecondaryAdminId(Number(e.target.value))}
        >
          <option value={0}>None</option>
          {secondaryAdmins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.fullName}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Saving…" : "Save assignment"}
      </button>
    </form>
  );
}
