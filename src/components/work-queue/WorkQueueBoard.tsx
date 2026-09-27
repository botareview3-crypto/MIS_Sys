"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";

const STATUSES = ["Received", "Repairing", "Ready", "Delivered"] as const;

const COLUMN_META: Record<(typeof STATUSES)[number], { dot: string; chip: string }> = {
  Received: { dot: "bg-status-received", chip: "bg-status-received" },
  Repairing: { dot: "bg-status-repairing", chip: "bg-status-repairing" },
  Ready: { dot: "bg-status-ready", chip: "bg-status-ready" },
  Delivered: { dot: "bg-status-delivered", chip: "bg-status-delivered" },
};

function initials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export type WorkQueueJob = {
  id: number;
  hostname: string | null;
  serialNumber: string | null;
  aucAssetBarcode: string | null;
  status: string;
  expectedCompletionDate: Date | null;
  overdue: boolean;
  customer: { fullName: string };
  technician: { id: number; fullName: string } | null;
};

type TechnicianOption = { id: number; fullName: string; role: string };

export function WorkQueueBoard({
  jobs,
  isAdmin,
  technicianOptions,
}: {
  jobs: WorkQueueJob[];
  isAdmin: boolean;
  technicianOptions: TechnicianOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [statusChoice, setStatusChoice] = useState<(typeof STATUSES)[number]>("Repairing");
  const [technicianChoice, setTechnicianChoice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const selectedCount = selected.size;
  const columns = useMemo(
    () => STATUSES.map((status) => ({ status, jobs: jobs.filter((j) => j.status === status) })),
    [jobs],
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setMessage(null);
  }

  async function applyStatus() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/repairs/bulk/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], status: statusChoice }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "The bulk status change could not be saved." });
        return;
      }
      const skippedNote = data.skipped?.length ? ` (${data.skipped.length} skipped — no access or already that status.)` : "";
      setMessage({ type: "success", text: `Updated ${data.updated.length} job(s) to ${statusChoice}.${skippedNote}` });
      setSelected(new Set());
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Could not reach the server. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function applyAssign() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/repairs/bulk/assign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], technicianId: technicianChoice, secondaryAdminId: null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "The bulk technician assignment could not be saved." });
        return;
      }
      const skippedNote = data.skipped?.length ? ` (${data.skipped.length} skipped.)` : "";
      setMessage({
        type: "success",
        text: data.technicianName
          ? `Reassigned ${data.updated.length} job(s) to ${data.technicianName}.${skippedNote}`
          : `Unassigned ${data.updated.length} job(s).${skippedNote}`,
      });
      setSelected(new Set());
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Could not reach the server. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={selectedCount > 0 ? "pb-24" : ""}>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {columns.map(({ status, jobs: colJobs }) => {
          const meta = COLUMN_META[status];
          return (
            <div key={status} className="rounded-3xl bg-white/50 p-3 backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between px-1.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
                  {status}
                </span>
                <span className={`data-mono rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${meta.chip}`}>
                  {colJobs.length}
                </span>
              </div>

              <div className="min-h-[80px] space-y-2.5">
                {colJobs.map((d) => (
                  <div
                    key={d.id}
                    className={`card-interactive p-3.5 ${d.overdue ? "ring-1 ring-inset ring-red-200" : ""} ${
                      selected.has(d.id) ? "ring-2 ring-inset ring-brand-400" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(d.id)}
                        onChange={() => toggle(d.id)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300"
                        aria-label={`Select ${d.hostname || "device"}`}
                      />
                      <Link href={`/devices/${d.id}`} className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <strong className="block truncate text-sm text-ink">{d.hostname || "Device"}</strong>
                          {d.overdue && (
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              <AlertTriangle className="h-3 w-3" />
                              Overdue
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-xs text-stone-500">{d.customer.fullName}</p>
                        <p className="data-mono mt-0.5 truncate text-[11px] text-stone-400">
                          {d.serialNumber || d.aucAssetBarcode || "—"}
                        </p>
                      </Link>
                    </div>

                    <div className="mt-3 flex items-center justify-between pl-6">
                      <span className={`text-[11px] ${d.overdue ? "font-semibold text-red-600" : "text-stone-400"}`}>
                        {d.expectedCompletionDate ? d.expectedCompletionDate.toISOString().slice(0, 10) : "No deadline"}
                      </span>
                      {d.technician && (
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-[10px] font-semibold text-white"
                          title={d.technician.fullName}
                        >
                          {initials(d.technician.fullName)}
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex gap-3 border-t border-stone-100 pt-2.5 pl-6 text-xs">
                      <Link href={`/repairs/${d.id}`} className="font-medium text-brand-600 hover:underline">
                        Update
                      </Link>
                      {isAdmin && (
                        <Link href={`/repairs/${d.id}/assign`} className="font-medium text-brand-600 hover:underline">
                          Assign
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
                {colJobs.length === 0 && <p className="px-2 py-6 text-center text-xs text-stone-400">No devices</p>}
              </div>
            </div>
          );
        })}
      </div>

      {jobs.length === 0 && (
        <div className="card mt-4 p-8 text-center text-sm text-stone-400">No devices match these filters.</div>
      )}

      {selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 p-4 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              {selectedCount} selected
              <button type="button" onClick={clearSelection} className="text-stone-400 hover:text-stone-600" aria-label="Clear selection">
                <X className="h-4 w-4" />
              </button>
            </span>

            <div className="flex items-center gap-2">
              <select
                className="input w-40"
                value={statusChoice}
                onChange={(e) => setStatusChoice(e.target.value as (typeof STATUSES)[number])}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button type="button" disabled={busy} onClick={applyStatus} className="btn-secondary">
                Set status
              </button>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2">
                <select
                  className="input w-48"
                  value={technicianChoice}
                  onChange={(e) => setTechnicianChoice(Number(e.target.value))}
                >
                  <option value={0}>Unassigned</option>
                  {technicianOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.role})
                    </option>
                  ))}
                </select>
                <button type="button" disabled={busy} onClick={applyAssign} className="btn-primary">
                  Reassign
                </button>
              </div>
            )}

            {message && (
              <span className={`text-xs font-medium ${message.type === "error" ? "text-red-600" : "text-green-700"}`}>
                {message.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
