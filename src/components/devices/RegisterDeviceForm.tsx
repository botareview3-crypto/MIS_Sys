"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Barcode, Plus, Trash2 } from "lucide-react";

type Technician = { id: number; fullName: string; role: string };

type DeviceEntry = {
  givenByName: string;
  aucAssetBarcode: string; // shown to the user as "PC barcode"
  serialNumber: string;
  macAddress: string;
  hostname: string;
  reportedProblemType: string;
  reportedProblemCustom: string;
  assignedTechnicianId: string;
  expectedCompletionDate: string;
  chargerReceived: boolean;
  networkCableBarcode: string;
  bagReceived: boolean;
};

// A new device block starts blank except for "given by" and the assigned
// technician, which carry over from the previous entry — for a multi-PC
// intake it's usually the same person dropping off / same tech for every
// device in the batch.
function emptyDevice(previous?: DeviceEntry): DeviceEntry {
  return {
    givenByName: previous?.givenByName ?? "",
    aucAssetBarcode: "",
    serialNumber: "",
    macAddress: "",
    hostname: "",
    reportedProblemType: "",
    reportedProblemCustom: "",
    assignedTechnicianId: previous?.assignedTechnicianId ?? "",
    expectedCompletionDate: "",
    chargerReceived: false,
    networkCableBarcode: "",
    bagReceived: false,
  };
}

export function RegisterDeviceForm({
  technicians,
  isTechnician,
}: {
  technicians: Technician[];
  isTechnician: boolean;
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState({
    title: "",
    customerFullName: "",
    phoneNumber: "",
    outlookEmail: "",
    outlookPassword: "",
    regionalOffice: "",
  });
  const [devices, setDevices] = useState<DeviceEntry[]>([emptyDevice()]);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function setCustomerField<K extends keyof typeof customer>(key: K, value: (typeof customer)[K]) {
    setCustomer((c) => ({ ...c, [key]: value }));
  }

  function setDeviceField<K extends keyof DeviceEntry>(index: number, key: K, value: DeviceEntry[K]) {
    setDevices((ds) => ds.map((d, i) => (i === index ? { ...d, [key]: value } : d)));
  }

  function addDevice() {
    setDevices((ds) => [...ds, emptyDevice(ds[ds.length - 1])]);
  }

  function removeDevice(index: number) {
    setDevices((ds) => (ds.length <= 1 ? ds : ds.filter((_, i) => i !== index)));
  }

  // USB barcode scanners act as a keyboard — they just "type" the scanned
  // value into whichever field is focused, then usually send an Enter
  // keystroke. Left alone, that Enter would submit the whole form as soon
  // as one barcode is scanned, so it's suppressed on the barcode fields.
  function blockEnterSubmit(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.preventDefault();
  }

  function resetCustomerFields() {
    setCustomer({
      title: "",
      customerFullName: "",
      phoneNumber: "",
      outlookEmail: "",
      outlookPassword: "",
      regionalOffice: "",
    });
    setDevices([emptyDevice()]);
    setMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    const registered: { jobId: string; receiptNumber: string }[] = [];
    try {
      for (let i = 0; i < devices.length; i++) {
        const payload = { ...customer, ...devices[i] };
        const res = await fetch("/api/devices/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          const doneCount = registered.length;
          const prefix =
            doneCount > 0
              ? `${doneCount} of ${devices.length} device(s) were registered before this error, on device ${i + 1}: `
              : "";
          setMessage({ type: "error", text: `${prefix}${data.error ?? "Device registration failed."}` });
          // Drop the devices that already registered so resubmitting doesn't duplicate them.
          if (doneCount > 0) setDevices((ds) => ds.slice(doneCount));
          return;
        }
        registered.push({ jobId: data.jobId, receiptNumber: data.receiptNumber });
      }

      const summary = registered.map((r) => `${r.jobId} (${r.receiptNumber})`).join(", ");
      setMessage({
        type: "success",
        text: `${registered.length} device${registered.length > 1 ? "s" : ""} registered successfully: ${summary}. Customer details below are kept for their next device — click "New customer" if the next one is someone else.`,
      });
      router.refresh();
      setDevices((ds) => [emptyDevice(ds[ds.length - 1])]);
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
          Registering more PCs for the same person? Leave these filled in, use &ldquo;Add device&rdquo; below for
          each additional PC. Click &ldquo;New customer&rdquo; to clear everything for someone else.
        </p>
        <div className="grid grid-cols-[100px_1fr] gap-3">
          <select className="input" value={customer.title} onChange={(e) => setCustomerField("title", e.target.value)}>
            <option value="">Title</option>
            <option value="Mr">Mr</option>
            <option value="Ms">Ms</option>
          </select>
          <input
            className="input"
            placeholder="Customer full name"
            value={customer.customerFullName}
            onChange={(e) => setCustomerField("customerFullName", e.target.value)}
            required
          />
        </div>
        <input
          className="input"
          placeholder="Phone number"
          value={customer.phoneNumber}
          onChange={(e) => setCustomerField("phoneNumber", e.target.value)}
          required
        />
        <div>
          <div className="flex items-stretch">
            <input
              className="input rounded-r-none"
              placeholder="Outlook username"
              value={customer.outlookEmail}
              onChange={(e) => setCustomerField("outlookEmail", e.target.value)}
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
          value={customer.outlookPassword}
          onChange={(e) => setCustomerField("outlookPassword", e.target.value)}
        />
        <input
          className="input"
          placeholder="Regional office / location (optional, e.g. for Intra devices)"
          value={customer.regionalOffice}
          onChange={(e) => setCustomerField("regionalOffice", e.target.value)}
        />
      </fieldset>

      {devices.map((device, index) => (
        <fieldset key={index} className="space-y-4 rounded-2xl border border-stone-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <legend className="text-sm font-semibold text-stone-900">
              Device{devices.length > 1 ? ` ${index + 1}` : ""}
            </legend>
            {devices.length > 1 && (
              <button
                type="button"
                onClick={() => removeDevice(index)}
                className="flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
              >
                <Trash2 size={14} />
                Remove
              </button>
            )}
          </div>
          <input
            className="input"
            placeholder="Given by (name of person dropping off)"
            value={device.givenByName}
            onChange={(e) => setDeviceField(index, "givenByName", e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <input
                className="input pr-10"
                placeholder="PC barcode"
                value={device.aucAssetBarcode}
                onChange={(e) => setDeviceField(index, "aucAssetBarcode", e.target.value)}
                onKeyDown={blockEnterSubmit}
                required
              />
              <Barcode
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"
              />
            </div>
            <div className="relative">
              <input
                className="input pr-10"
                placeholder="Serial number"
                value={device.serialNumber}
                onChange={(e) => setDeviceField(index, "serialNumber", e.target.value)}
                onKeyDown={blockEnterSubmit}
                required
              />
              <Barcode
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"
              />
            </div>
            <input
              className="input"
              placeholder="MAC address (optional)"
              value={device.macAddress}
              onChange={(e) => setDeviceField(index, "macAddress", e.target.value)}
            />
            <input
              className="input"
              placeholder="Hostname"
              value={device.hostname}
              onChange={(e) => setDeviceField(index, "hostname", e.target.value)}
              required
            />
          </div>

          <select
            className="input"
            value={device.reportedProblemType}
            onChange={(e) => setDeviceField(index, "reportedProblemType", e.target.value)}
            required
          >
            <option value="">Reported problem…</option>
            <option value="pc_configuration_sap_cisco">PC Configuration, SAP and CISCO Installation</option>
            <option value="other">Other (describe below)</option>
          </select>
          {device.reportedProblemType === "other" && (
            <textarea
              className="input"
              rows={3}
              placeholder="Describe the reported problem"
              value={device.reportedProblemCustom}
              onChange={(e) => setDeviceField(index, "reportedProblemCustom", e.target.value)}
              required
            />
          )}

          {!isTechnician && (
            <select
              className="input"
              value={device.assignedTechnicianId}
              onChange={(e) => setDeviceField(index, "assignedTechnicianId", e.target.value)}
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
              value={device.expectedCompletionDate}
              onChange={(e) => setDeviceField(index, "expectedCompletionDate", e.target.value)}
            />
          </div>

          <div className="space-y-3 border-t border-stone-100 pt-3">
            <p className="text-sm font-semibold text-stone-900">Accessories</p>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={device.chargerReceived}
                onChange={(e) => setDeviceField(index, "chargerReceived", e.target.checked)}
              />
              Charger received
            </label>
            <div className="relative">
              <input
                className="input pr-10"
                placeholder="Network cable barcode"
                value={device.networkCableBarcode}
                onChange={(e) => setDeviceField(index, "networkCableBarcode", e.target.value)}
                onKeyDown={blockEnterSubmit}
                required
              />
              <Barcode
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={device.bagReceived}
                onChange={(e) => setDeviceField(index, "bagReceived", e.target.checked)}
              />
              Bag received
            </label>
          </div>
        </fieldset>
      ))}

      <button
        type="button"
        onClick={addDevice}
        className="flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-stone-300 py-2.5 text-sm font-medium text-brand-600 transition hover:border-brand-400 hover:bg-brand-50"
      >
        <Plus size={16} />
        Add device
      </button>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Registering…" : "Register devices"}
      </button>
    </form>
  );
}
