"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Technician = { id: number; fullName: string; role: string };

export function RegisterDeviceForm({
  technicians,
  isTechnician,
}: {
  technicians: Technician[];
  isTechnician: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    customerFullName: "",
    phoneNumber: "",
    outlookEmail: "",
    outlookPassword: "",
    regionalOffice: "",
    givenByName: "",
    aucAssetBarcode: "",
    serialNumber: "",
    macAddress: "",
    hostname: "",
    reportedProblemType: "",
    reportedProblemCustom: "",
    assignedTechnicianId: "",
    expectedCompletionDate: "",
    chargerReceived: false,
    networkCableBarcode: "",
    bagReceived: false,
  });
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Only the device-specific fields reset after a successful registration —
  // the customer fields (name, phone, outlook login) are deliberately left
  // filled in so the same person's next PC doesn't need them retyped. Added
  // 2026-09-26: previously the whole form cleared, so registering N devices
  // for one customer meant entering their details N times.
  function resetDeviceFields() {
    setForm((f) => ({
      ...f,
      aucAssetBarcode: "",
      serialNumber: "",
      macAddress: "",
      hostname: "",
      reportedProblemType: "",
      reportedProblemCustom: "",
      expectedCompletionDate: "",
      chargerReceived: false,
      networkCableBarcode: "",
      bagReceived: false,
      // givenByName and assignedTechnicianId are left as-is too — for a
      // multi-PC intake they're usually the same person/tech for every
      // device in the batch. Cleared explicitly via "New customer" below.
    }));
  }

  function resetCustomerFields() {
    setForm((f) => ({
      ...f,
      title: "",
      customerFullName: "",
      phoneNumber: "",
      outlookEmail: "",
      outlookPassword: "",
      regionalOffice: "",
      givenByName: "",
      assignedTechnicianId: "",
    }));
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Device registration failed." });
        return;
      }
      setMessage({
        type: "success",
        text: `Device registered successfully. Job ID: ${data.jobId} · Receipt: ${data.receiptNumber}. Customer details below are kept for their next device — click "New customer" if the next one is someone else.`,
      });
      router.refresh();
      resetDeviceFields();
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
        <div className="flex items-center justify-between gap-3">
          <legend className="text-sm font-semibold text-stone-900">Customer</legend>
          <button
            type="button"
            onClick={resetCustomerFields}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            New customer
          </button>
        </div>
        <p className="text-xs text-stone-500">
          Registering another PC for the same person? Leave these filled in and just fill out the Device
          section below. Click &ldquo;New customer&rdquo; to clear them for someone else.
        </p>
        <div className="grid grid-cols-[100px_1fr] gap-3">
          <select className="input" value={form.title} onChange={(e) => set("title", e.target.value)}>
            <option value="">Title</option>
            <option value="Mr">Mr</option>
            <option value="Ms">Ms</option>
          </select>
          <input
            className="input"
            placeholder="Customer full name"
            value={form.customerFullName}
            onChange={(e) => set("customerFullName", e.target.value)}
            required
          />
        </div>
        <input
          className="input"
          placeholder="Phone number"
          value={form.phoneNumber}
          onChange={(e) => set("phoneNumber", e.target.value)}
          required
        />
        <div>
          <div className="flex items-stretch">
            <input
              className="input rounded-r-none"
              placeholder="Outlook username"
              value={form.outlookEmail}
              onChange={(e) => set("outlookEmail", e.target.value)}
              required
            />
            <span className="flex items-center rounded-r-lg border border-l-0 border-stone-300 bg-stone-50 px-3 text-sm text-stone-500">
              @africanunion.org
            </span>
          </div>
        </div>
        <input
          type="password"
          className="input"
          placeholder="Outlook password (stored encrypted)"
          value={form.outlookPassword}
          onChange={(e) => set("outlookPassword", e.target.value)}
        />
        <input
          className="input"
          placeholder="Regional office / location (optional, e.g. for Intra devices)"
          value={form.regionalOffice}
          onChange={(e) => set("regionalOffice", e.target.value)}
        />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-stone-900">Device</legend>
        <input
          className="input"
          placeholder="Given by (name of person dropping off)"
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
            placeholder="MAC address (optional)"
            value={form.macAddress}
            onChange={(e) => set("macAddress", e.target.value)}
          />
          <input
            className="input"
            placeholder="Hostname (optional)"
            value={form.hostname}
            onChange={(e) => set("hostname", e.target.value)}
          />
        </div>

        <select
          className="input"
          value={form.reportedProblemType}
          onChange={(e) => set("reportedProblemType", e.target.value)}
          required
        >
          <option value="">Reported problem…</option>
          <option value="pc_configuration_sap_cisco">PC Configuration, SAP and CISCO Installation</option>
          <option value="other">Other (describe below)</option>
        </select>
        {form.reportedProblemType === "other" && (
          <textarea
            className="input"
            rows={3}
            placeholder="Describe the reported problem"
            value={form.reportedProblemCustom}
            onChange={(e) => set("reportedProblemCustom", e.target.value)}
            required
          />
        )}

        {!isTechnician && (
          <select
            className="input"
            value={form.assignedTechnicianId}
            onChange={(e) => set("assignedTechnicianId", e.target.value)}
          >
            <option value="">Assign technician (optional)</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName} ({t.role})
              </option>
            ))}
          </select>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">
            Expected completion date (optional)
          </label>
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
          placeholder="Network cable barcode (optional)"
          value={form.networkCableBarcode}
          onChange={(e) => set("networkCableBarcode", e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={form.bagReceived} onChange={(e) => set("bagReceived", e.target.checked)} />
          Bag received
        </label>
      </fieldset>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Registering…" : "Register device"}
      </button>
    </form>
  );
}
