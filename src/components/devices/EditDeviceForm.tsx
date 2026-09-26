"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STANDARD_PROBLEM = "PC Configuration, SAP and CISCO Installation";

type Initial = {
  title: string;
  customerName: string;
  phoneNumber: string;
  outlookEmail: string;
  givenByName: string;
  aucAssetBarcode: string;
  serialNumber: string;
  macAddress: string;
  hostname: string;
  reportedProblem: string;
  expectedCompletionDate: string;
  chargerReceived: boolean;
  networkCableBarcode: string;
  bagReceived: boolean;
};

function toFormState(initial: Initial) {
  const isStandard = initial.reportedProblem.trim().toLowerCase() === STANDARD_PROBLEM.toLowerCase();
  return {
    title: initial.title,
    customerName: initial.customerName,
    phoneNumber: initial.phoneNumber,
    outlookEmail: initial.outlookEmail,
    givenByName: initial.givenByName,
    aucAssetBarcode: initial.aucAssetBarcode,
    serialNumber: initial.serialNumber,
    macAddress: initial.macAddress,
    hostname: initial.hostname,
    reportedProblemType: initial.reportedProblem === "" ? "" : isStandard ? "pc_configuration_sap_cisco" : "other",
    reportedProblemCustom: isStandard ? "" : initial.reportedProblem,
    expectedCompletionDate: initial.expectedCompletionDate,
    chargerReceived: initial.chargerReceived,
    networkCableBarcode: initial.networkCableBarcode,
    bagReceived: initial.bagReceived,
  };
}

export function EditDeviceForm({
  deviceId,
  initial,
  isRegional,
}: {
  deviceId: number;
  initial: Initial;
  isRegional: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(toFormState(initial));
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof ReturnType<typeof toFormState>>(key: K, value: ReturnType<typeof toFormState>[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "The device could not be updated." });
        return;
      }
      setMessage({
        type: "success",
        text: data.noChanges ? "No device changes were necessary." : "Device updated successfully.",
      });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Could not reach the server. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {message && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-stone-900">Customer</legend>
        <div className="grid grid-cols-[100px_1fr] gap-3">
          <select className="input" value={form.title} onChange={(e) => set("title", e.target.value)}>
            <option value="">Title</option>
            <option value="Mr">Mr</option>
            <option value="Ms">Ms</option>
          </select>
          <input
            className="input"
            value={form.customerName}
            onChange={(e) => set("customerName", e.target.value)}
            required={!isRegional}
          />
        </div>
        <input
          className="input"
          placeholder="Phone number"
          value={form.phoneNumber}
          onChange={(e) => set("phoneNumber", e.target.value)}
        />
        <input
          className="input"
          placeholder="Outlook email"
          value={form.outlookEmail}
          onChange={(e) => set("outlookEmail", e.target.value)}
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-stone-900">Device</legend>
        <input
          className="input"
          placeholder="Given by"
          value={form.givenByName}
          onChange={(e) => set("givenByName", e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="AUC asset barcode"
            value={form.aucAssetBarcode}
            onChange={(e) => set("aucAssetBarcode", e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="Serial number"
            value={form.serialNumber}
            onChange={(e) => set("serialNumber", e.target.value)}
            required
          />
          <input
            className="input"
            placeholder="MAC address"
            value={form.macAddress}
            onChange={(e) => set("macAddress", e.target.value)}
          />
          <input
            className="input"
            placeholder="Hostname"
            value={form.hostname}
            onChange={(e) => set("hostname", e.target.value)}
          />
        </div>

        <select
          className="input"
          value={form.reportedProblemType}
          onChange={(e) => set("reportedProblemType", e.target.value)}
        >
          <option value="">Reported problem…</option>
          <option value="pc_configuration_sap_cisco">PC Configuration, SAP and CISCO Installation</option>
          <option value="other">Other (describe below)</option>
        </select>
        {form.reportedProblemType === "other" && (
          <textarea
            className="input"
            rows={3}
            value={form.reportedProblemCustom}
            onChange={(e) => set("reportedProblemCustom", e.target.value)}
          />
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Expected completion date</label>
          <input
            type="date"
            className="input"
            value={form.expectedCompletionDate}
            onChange={(e) => set("expectedCompletionDate", e.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-stone-900">Accessories</legend>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={form.chargerReceived}
            onChange={(e) => set("chargerReceived", e.target.checked)}
          />
          Charger received
        </label>
        <input
          className="input"
          placeholder="Network cable barcode"
          value={form.networkCableBarcode}
          onChange={(e) => set("networkCableBarcode", e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={form.bagReceived} onChange={(e) => set("bagReceived", e.target.checked)} />
          Bag received
        </label>
      </fieldset>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
