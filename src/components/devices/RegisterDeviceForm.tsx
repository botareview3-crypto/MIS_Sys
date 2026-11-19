"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Plus, ScanLine, Trash2 } from "lucide-react";

type Technician = { id: number; fullName: string; role: string };

// Every local device's hostname is meant to follow this convention; the
// field starts pre-filled with it so the person only has to type the
// distinguishing part.
const HOSTNAME_PREFIX = "AUC-HQ-";

// Unsubmitted-form draft, kept in the browser only (never sent to the
// server). Deliberately excludes the Outlook password on every save/load —
// stashing a plaintext credential in localStorage would be a real risk on
// a shared reception PC, so that field always has to be retyped.
const DRAFT_KEY = "arp-register-device-draft";

type CustomerState = {
  customerId: string; // "" = will create a new customer row on submit
  title: string;
  customerFullName: string;
  phoneNumber: string;
  outlookEmail: string;
  outlookPassword: string;
  regionalOffice: string;
};

function defaultCustomer(): CustomerState {
  return {
    customerId: "",
    title: "",
    customerFullName: "",
    phoneNumber: "",
    outlookEmail: "",
    outlookPassword: "",
    regionalOffice: "",
  };
}

type DeviceEntry = {
  givenByName: string;
  aucAssetBarcode: string; // shown to the user as "PC barcode"
  serialNumber: string; // shown to the user as "PC serial number"
  macAddress: string;
  hostname: string;
  networkCableBarcode: string;
  nicReceived: boolean; // gates whether networkCableBarcode can be edited
  reportedProblemType: string;
  reportedProblemCustom: string;
  assignedTechnicianId: string;
  chargerReceived: boolean;
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
    hostname: HOSTNAME_PREFIX,
    networkCableBarcode: "",
    nicReceived: false,
    reportedProblemType: "",
    reportedProblemCustom: "",
    assignedTechnicianId: previous?.assignedTechnicianId ?? "",
    chargerReceived: false,
    bagReceived: false,
  };
}

function loadDraft(): { customer: CustomerState; devices: DeviceEntry[] } | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const devices = Array.isArray(parsed.devices) && parsed.devices.length > 0 ? parsed.devices : null;
    if (!devices) return null;
    return {
      customer: { ...defaultCustomer(), ...parsed.customer, outlookPassword: "" },
      devices,
    };
  } catch {
    return null;
  }
}

type CustomerSuggestion = {
  id: number;
  title: string | null;
  fullName: string;
  phoneNumber: string;
  outlookEmail: string;
  regionalOffice: string | null;
};

type DupField = "aucAssetBarcode" | "serialNumber" | "macAddress" | "hostname";

const DUP_MESSAGES: Record<DupField, string> = {
  aucAssetBarcode: "This PC barcode is already registered.",
  serialNumber: "This PC serial number is already registered.",
  macAddress: "This MAC address is already registered.",
  hostname: "This hostname is already registered.",
};

export function RegisterDeviceForm({
  technicians,
  isTechnician,
}: {
  technicians: Technician[];
  isTechnician: boolean;
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerState>(defaultCustomer());
  const [devices, setDevices] = useState<DeviceEntry[]>([emptyDevice()]);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  // Devices registered in the most recent submit, kept so each one can get
  // a "Prepare Received Message" button right after registering (same
  // WhatsApp page the device details screen links to).
  const [justRegistered, setJustRegistered] = useState<
    { repairJobId: number; hostname: string; receiptNumber: string }[]
  >([]);

  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [suggestionsFor, setSuggestionsFor] = useState<"phone" | "outlook" | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dupChecks, setDupChecks] = useState<Record<string, boolean>>({});

  // Restore an unsubmitted draft after mount (not during the initial
  // render) so server-rendered and first-client-rendered markup match —
  // doing this in the lazy useState initializer instead would fill the
  // fields in with different values than the server sent, tripping a
  // hydration mismatch.
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setCustomer(draft.customer);
      setDevices(draft.devices);
      setDraftRestored(true);
    }
  }, []);

  // Keep the draft in sync with every change. Skips saving (and clears any
  // existing draft) once the form is back to being empty, so a fresh visit
  // doesn't leave a stale, pointless draft behind.
  useEffect(() => {
    const hasContent =
      customer.customerFullName.trim() !== "" ||
      customer.phoneNumber.trim() !== "" ||
      customer.outlookEmail.trim() !== "" ||
      devices.some(
        (d) =>
          d.givenByName.trim() !== "" ||
          d.aucAssetBarcode.trim() !== "" ||
          d.serialNumber.trim() !== "" ||
          d.hostname.trim() !== HOSTNAME_PREFIX
      );
    try {
      if (!hasContent) {
        window.localStorage.removeItem(DRAFT_KEY);
        return;
      }
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ customer: { ...customer, outlookPassword: "" }, devices })
      );
    } catch {
      // Best-effort — private browsing or a full storage quota can block this.
    }
  }, [customer, devices]);

  function setCustomerField<K extends keyof CustomerState>(key: K, value: CustomerState[K]) {
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
    setDupChecks({}); // indices shift — stale per-index flags would point at the wrong device
  }

  // USB barcode scanners act as a keyboard — they just "type" the scanned
  // value into whichever field is focused, then usually send an Enter
  // keystroke. Left alone, that Enter would submit the whole form as soon
  // as one barcode is scanned, so it's suppressed on the barcode fields.
  function blockEnterSubmit(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.preventDefault();
  }

  function resetCustomerFields() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore — nothing to clean up if storage isn't available
    }
    setCustomer(defaultCustomer());
    setDevices([emptyDevice()]);
    setDupChecks({});
    setSuggestions([]);
    setSuggestionsFor(null);
    setDraftRestored(false);
    setMessage(null);
    setJustRegistered([]);
  }

  // --- Returning-customer autocomplete (phone number / Outlook username) ---

  function scheduleCustomerSearch(field: "phone" | "outlook", query: string) {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setSuggestionsFor(null);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data.customers ?? []);
        setSuggestionsFor(field);
      } catch {
        // Best-effort convenience — typing the rest by hand still works fine.
      }
    }, 350);
  }

  function selectCustomerSuggestion(c: CustomerSuggestion) {
    setCustomer({
      customerId: String(c.id),
      title: c.title ?? "",
      customerFullName: c.fullName,
      phoneNumber: c.phoneNumber,
      outlookEmail: c.outlookEmail.replace(/@africanunion\.org$/i, ""),
      outlookPassword: "",
      regionalOffice: c.regionalOffice ?? "",
    });
    setSuggestions([]);
    setSuggestionsFor(null);
  }

  function renderSuggestions(forField: "phone" | "outlook") {
    if (suggestionsFor !== forField || suggestions.length === 0) return null;
    return (
      <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-stone-200 bg-white shadow-lg">
        {suggestions.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onMouseDown={() => selectCustomerSuggestion(c)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-brand-50"
            >
              <span className="font-medium text-stone-900">{c.fullName}</span>
              <span className="block text-xs text-stone-500">
                {c.phoneNumber} · {c.outlookEmail}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  // --- Live duplicate check (PC barcode / serial / MAC / hostname) ---

  function dupKey(index: number, field: DupField) {
    return `${index}:${field}`;
  }

  function clearDupCheck(index: number, field: DupField) {
    setDupChecks((d) => {
      const key = dupKey(index, field);
      if (!(key in d)) return d;
      const next = { ...d };
      delete next[key];
      return next;
    });
  }

  async function checkDuplicate(index: number, field: DupField, value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      clearDupCheck(index, field);
      return;
    }
    try {
      const res = await fetch(`/api/devices/check-duplicate?field=${field}&value=${encodeURIComponent(trimmed)}`);
      if (!res.ok) return;
      const data = await res.json();
      setDupChecks((d) => ({ ...d, [dupKey(index, field)]: !!data.duplicate }));
    } catch {
      // Best-effort — the real check still happens on submit either way.
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setJustRegistered([]);
    setLoading(true);

    // Local, not state — needs to reflect a customer created/matched by an
    // earlier device in this same batch before the next device's request
    // goes out, which a setState wouldn't do until the next render.
    let customerId = customer.customerId;
    const registered: { repairJobId: number; hostname: string; receiptNumber: string }[] = [];
    try {
      for (let i = 0; i < devices.length; i++) {
        const payload = { ...customer, ...devices[i], customerId };
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
          if (doneCount > 0) {
            setDevices((ds) => ds.slice(doneCount));
            setJustRegistered(registered);
          }
          if (customerId !== customer.customerId) setCustomer((c) => ({ ...c, customerId }));
          return;
        }
        if (data.customerId) customerId = String(data.customerId); // the server may have split off a new customer row
        registered.push({
          repairJobId: data.repairJobId,
          hostname: devices[i].hostname.trim(),
          receiptNumber: data.receiptNumber,
        });
      }

      const summary = registered.map((r) => `${r.hostname} (${r.receiptNumber})`).join(", ");
      setMessage({
        type: "success",
        text: `${registered.length} device${registered.length > 1 ? "s" : ""} registered successfully: ${summary}. Customer details below are kept for their next device — click "New customer" if the next one is someone else.`,
      });
      router.refresh();
      setCustomer((c) => ({ ...c, customerId }));
      setDevices((ds) => [emptyDevice(ds[ds.length - 1])]);
      setDupChecks({});
      setDraftRestored(false);

      // Same landing page as saving a repair as Received: the pre-filled
      // WhatsApp message. For a multi-device batch, the first device's
      // page carries the rest in ?queue= so staff can step through them.
      const ids = registered.map((r) => r.repairJobId).filter((n) => Number.isInteger(n));
      if (ids.length > 0) {
        const rest = ids.slice(1);
        router.push(`/repairs/${ids[0]}/follow-up${rest.length > 0 ? `?queue=${rest.join(",")}` : ""}`);
        return;
      }
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

      {justRegistered.length > 0 && (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-900">These devices were registered — send their Received message:</p>
          <ul className="space-y-2">
            {justRegistered.map((r) => (
              <li key={r.repairJobId} className="flex items-center justify-between gap-3 text-sm text-emerald-900">
                <span>
                  {r.hostname} <span className="text-emerald-700">({r.receiptNumber})</span>
                </span>
                <a
                  href={`/repairs/${r.repairJobId}/follow-up`}
                  className="btn-primary flex items-center gap-1.5 bg-emerald-600 px-3 py-1.5 text-xs hover:bg-emerald-700"
                >
                  <MessageCircle size={14} />
                  Send WhatsApp Message
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {draftRestored && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span>Restored your unsaved draft from earlier.</span>
          <button type="button" onClick={resetCustomerFields} className="font-medium underline hover:no-underline">
            Discard
          </button>
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
          each additional PC. Click &ldquo;New customer&rdquo; to clear everything for someone else. Typing a phone
          number or Outlook username will offer a matching returning customer to fill in automatically.
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
        <div className="relative">
          <input
            className="input"
            placeholder="Phone number"
            value={customer.phoneNumber}
            onChange={(e) => {
              setCustomerField("phoneNumber", e.target.value);
              scheduleCustomerSearch("phone", e.target.value);
            }}
            onFocus={() => {
              if (customer.phoneNumber.trim().length >= 3) scheduleCustomerSearch("phone", customer.phoneNumber);
            }}
            onBlur={() => setTimeout(() => setSuggestionsFor((f) => (f === "phone" ? null : f)), 150)}
            required
          />
          {renderSuggestions("phone")}
        </div>
        <div className="relative">
          <div className="flex items-stretch">
            <input
              className="input rounded-r-none"
              placeholder="Outlook username"
              value={customer.outlookEmail}
              onChange={(e) => {
                setCustomerField("outlookEmail", e.target.value);
                scheduleCustomerSearch("outlook", e.target.value);
              }}
              onFocus={() => {
                if (customer.outlookEmail.trim().length >= 3) scheduleCustomerSearch("outlook", customer.outlookEmail);
              }}
              onBlur={() => setTimeout(() => setSuggestionsFor((f) => (f === "outlook" ? null : f)), 150)}
              required
            />
            <span className="flex items-center rounded-r-lg border border-l-0 border-stone-300 bg-stone-50 px-3 text-sm text-stone-500">
              @africanunion.org
            </span>
          </div>
          {renderSuggestions("outlook")}
        </div>
        <input
          type="password"
          className="input"
          placeholder={
            customer.customerId
              ? "Outlook password (leave blank to keep the one on file)"
              : "Outlook password (stored encrypted)"
          }
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
            <div>
              <div className="relative">
                <input
                  className="input pr-10"
                  placeholder="PC barcode"
                  value={device.aucAssetBarcode}
                  onChange={(e) => {
                    setDeviceField(index, "aucAssetBarcode", e.target.value);
                    clearDupCheck(index, "aucAssetBarcode");
                  }}
                  onKeyDown={blockEnterSubmit}
                  onBlur={(e) => checkDuplicate(index, "aucAssetBarcode", e.target.value)}
                  required
                />
                <ScanLine
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"
                />
              </div>
              {dupChecks[dupKey(index, "aucAssetBarcode")] && (
                <p className="mt-1 text-xs text-red-600">{DUP_MESSAGES.aucAssetBarcode}</p>
              )}
            </div>
            <div>
              <div className="relative">
                <input
                  className="input pr-10"
                  placeholder="PC serial number"
                  value={device.serialNumber}
                  onChange={(e) => {
                    setDeviceField(index, "serialNumber", e.target.value);
                    clearDupCheck(index, "serialNumber");
                  }}
                  onKeyDown={blockEnterSubmit}
                  onBlur={(e) => checkDuplicate(index, "serialNumber", e.target.value)}
                  required
                />
                <ScanLine
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"
                />
              </div>
              {dupChecks[dupKey(index, "serialNumber")] && (
                <p className="mt-1 text-xs text-red-600">{DUP_MESSAGES.serialNumber}</p>
              )}
            </div>
            <div>
              <input
                className="input"
                placeholder="MAC address (optional)"
                value={device.macAddress}
                onChange={(e) => {
                  setDeviceField(index, "macAddress", e.target.value);
                  clearDupCheck(index, "macAddress");
                }}
                onBlur={(e) => checkDuplicate(index, "macAddress", e.target.value)}
              />
              {dupChecks[dupKey(index, "macAddress")] && (
                <p className="mt-1 text-xs text-red-600">{DUP_MESSAGES.macAddress}</p>
              )}
            </div>
            <div>
              <input
                className="input"
                placeholder="Hostname"
                value={device.hostname}
                onChange={(e) => {
                  setDeviceField(index, "hostname", e.target.value);
                  clearDupCheck(index, "hostname");
                }}
                onBlur={(e) => checkDuplicate(index, "hostname", e.target.value)}
                required
              />
              {dupChecks[dupKey(index, "hostname")] && (
                <p className="mt-1 text-xs text-red-600">{DUP_MESSAGES.hostname}</p>
              )}
            </div>
            <div className="relative col-span-2">
              <input
                className={`input pr-10 ${!device.nicReceived ? "cursor-not-allowed opacity-50" : ""}`}
                placeholder="Network cable barcode"
                value={device.networkCableBarcode}
                onChange={(e) => setDeviceField(index, "networkCableBarcode", e.target.value)}
                onKeyDown={blockEnterSubmit}
                disabled={!device.nicReceived}
                required={device.nicReceived}
              />
              <ScanLine
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-400"
              />
            </div>
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
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={device.nicReceived}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setDevices((ds) =>
                    ds.map((d, i) =>
                      i === index
                        ? { ...d, nicReceived: checked, networkCableBarcode: checked ? d.networkCableBarcode : "" }
                        : d
                    )
                  );
                }}
              />
              NIC received
            </label>
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
