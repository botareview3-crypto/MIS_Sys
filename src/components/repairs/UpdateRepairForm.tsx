"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["Received", "Repairing", "Ready", "Delivered"] as const;

type Initial = {
  technicianDiagnosis: string;
  repairNotes: string;
  status: string;
  expectedCompletionDate: string;
  chargerReceived: boolean;
  chargerReturned: boolean;
  networkCableReceived: boolean;
  networkCableReturned: boolean;
  bagReceived: boolean;
  bagReturned: boolean;
};

export function UpdateRepairForm({
  deviceId,
  initial,
  canSendWhatsapp,
  canPrintReceipt,
}: {
  deviceId: number;
  initial: Initial;
  canSendWhatsapp: boolean;
  /** Whether this viewer may open /receipts/[id] (Admin, Reception, or the assigned Technician). */
  canPrintReceipt: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    technicianDiagnosis: initial.technicianDiagnosis,
    repairNotes: initial.repairNotes,
    status: initial.status,
    changeNote: "",
    expectedCompletionDate: initial.expectedCompletionDate,
    chargerReturned: initial.chargerReturned,
    networkCableReturned: initial.networkCableReturned,
    bagReturned: initial.bagReturned,
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
      const res = await fetch(`/api/repairs/${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "The repair update could not be saved." });
        return;
      }
      let text = data.noChanges ? "No changes were necessary." : "Repair information updated successfully.";
      if (data.workflowReceiptReference) {
        text += ` ${data.workflowReceiptType} receipt available: ${data.workflowReceiptReference}.`;
      }
      setMessage({ type: "success", text });

      // Received / Ready / Delivered each have a follow-up page (WhatsApp
      // message; for Delivered also the printable handover form) so those
      // actions aren't crammed above this form. Received and Ready open it
      // only when the status actually changed, so re-saving notes on a Ready
      // job doesn't bounce staff to a WhatsApp page. Delivered always opens
      // it, so the handover form is reachable even on an already-Delivered
      // job. Only for roles that can use it (Admin, Reception, the assigned
      // Technician); Secondary Admin has no WhatsApp/receipt access and stays here.
      const opensFollowUp =
        (form.status === "Delivered" && canSendWhatsapp && canPrintReceipt) ||
        (["Received", "Ready"].includes(form.status) && data.statusChanged && canSendWhatsapp);
      if (opensFollowUp) {
        router.push(`/repairs/${deviceId}/follow-up`);
        return;
      }
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Could not reach the server. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {message && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
            message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          <span>{message.text}</span>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Status</label>
        <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {form.status !== initial.status && (
        <input
          className="input"
          placeholder="Status-change note (optional)"
          value={form.changeNote}
          onChange={(e) => set("changeNote", e.target.value)}
        />
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Technician diagnosis</label>
        <textarea
          className="input"
          rows={4}
          value={form.technicianDiagnosis}
          onChange={(e) => set("technicianDiagnosis", e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Repair notes</label>
        <textarea
          className="input"
          rows={5}
          value={form.repairNotes}
          onChange={(e) => set("repairNotes", e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-stone-700">Expected completion date</label>
        <input
          type="date"
          className="input"
          value={form.expectedCompletionDate}
          onChange={(e) => set("expectedCompletionDate", e.target.value)}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-stone-900">Accessory returns</legend>
        {initial.chargerReceived && (
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.chargerReturned}
              onChange={(e) => set("chargerReturned", e.target.checked)}
            />
            Charger returned to customer
          </label>
        )}
        {initial.networkCableReceived && (
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.networkCableReturned}
              onChange={(e) => set("networkCableReturned", e.target.checked)}
            />
            Network cable returned to customer
          </label>
        )}
        {initial.bagReceived && (
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={form.bagReturned} onChange={(e) => set("bagReturned", e.target.checked)} />
            Bag returned to customer
          </label>
        )}
        {!initial.chargerReceived && !initial.networkCableReceived && !initial.bagReceived && (
          <p className="text-sm text-stone-400">No accessories were received with this device.</p>
        )}
      </fieldset>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Saving…" : "Save repair update"}
      </button>
    </form>
  );
}
