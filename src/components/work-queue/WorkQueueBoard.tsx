"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, MessageCircle, X } from "lucide-react";

const STATUSES = ["Received", "Repairing", "Ready", "Delivered"] as const;

// Jobs per bulk request — see sendInChunks.
const BULK_CHUNK_SIZE = 15;

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

// Statuses that have a WhatsApp message template ready to go — same three
// UpdateRepairForm already offers the "Send … WhatsApp message" button for
// (src/components/repairs/UpdateRepairForm.tsx), which in turn mirrors
// WHATSAPP_MESSAGE_TYPES in src/lib/whatsapp.ts.
const WHATSAPP_STATUSES = new Set(["Received", "Ready", "Delivered"]);

export function WorkQueueBoard({
  jobs,
  isAdmin,
  technicianOptions,
  view,
  canSendWhatsapp,
}: {
  jobs: WorkQueueJob[];
  isAdmin: boolean;
  technicianOptions: TechnicianOption[];
  view: "list" | "board";
  canSendWhatsapp: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [statusChoice, setStatusChoice] = useState<(typeof STATUSES)[number]>("Repairing");
  const [technicianChoice, setTechnicianChoice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Kanban-only state (view === "board"). Kept separate from the list
  // view's selection/bulk state above — dragging and multi-select
  // checkboxes are two different interaction models and this component
  // never needs both active at once.
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [whatsappPrompt, setWhatsappPrompt] = useState<{ jobId: number; hostname: string; status: string } | null>(
    null,
  );

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

  // Select every card in a column, or clear them if they're all already selected.
  function toggleColumn(ids: number[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setMessage(null);
  }

  // Bulk actions are sent in small batches, one request each. A single request
  // for many jobs runs inside one interactive DB transaction on the server
  // (~6 round trips per job to a remote Postgres) and can time out or exceed
  // the host's request limit, which rolls the whole batch back. Small batches
  // keep every request short, show progress, and mean a failure part-way only
  // affects the batch it happened in — everything before it is already saved.
  async function sendInChunks(url: string, ids: number[], extra: Record<string, unknown>, label: string) {
    const processed: number[] = []; // updated OR skipped by the server — nothing left to do for these
    let updatedCount = 0;
    let skippedCount = 0;
    let technicianName: string | null = null;

    for (let i = 0; i < ids.length; i += BULK_CHUNK_SIZE) {
      const chunk = ids.slice(i, i + BULK_CHUNK_SIZE);
      if (ids.length > BULK_CHUNK_SIZE) {
        setMessage({ type: "success", text: `${label}… ${i} of ${ids.length} done` });
      }
      try {
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: chunk, ...extra }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { processed, updatedCount, skippedCount, technicianName, error: (data.error as string) ?? "The change could not be saved." };
        }
        processed.push(...chunk);
        updatedCount += data.updated?.length ?? 0;
        skippedCount += data.skipped?.length ?? 0;
        if (data.technicianName) technicianName = data.technicianName;
      } catch {
        return { processed, updatedCount, skippedCount, technicianName, error: "Could not reach the server. Please try again." };
      }
    }
    return { processed, updatedCount, skippedCount, technicianName, error: null as string | null };
  }

  // Drop finished ids from the selection so a retry only covers what's left.
  function keepUnprocessed(processed: number[]) {
    const done = new Set(processed);
    setSelected((prev) => new Set([...prev].filter((id) => !done.has(id))));
  }

  async function applyStatus() {
    setBusy(true);
    setMessage(null);
    const ids = [...selected];
    const r = await sendInChunks("/api/repairs/bulk/status", ids, { status: statusChoice }, "Updating");
    keepUnprocessed(r.processed);
    const skippedNote = r.skippedCount ? ` (${r.skippedCount} skipped — no access or already that status.)` : "";
    if (r.error) {
      setMessage({
        type: "error",
        text: `Updated ${r.updatedCount} of ${ids.length} job(s) to ${statusChoice} before an error: ${r.error} The rest are still selected — try again.${skippedNote}`,
      });
    } else {
      setMessage({ type: "success", text: `Updated ${r.updatedCount} job(s) to ${statusChoice}.${skippedNote}` });
    }
    router.refresh();
    setBusy(false);
  }

  async function applyAssign() {
    setBusy(true);
    setMessage(null);
    const ids = [...selected];
    const r = await sendInChunks(
      "/api/repairs/bulk/assign",
      ids,
      { technicianId: technicianChoice, secondaryAdminId: null },
      "Reassigning",
    );
    keepUnprocessed(r.processed);
    const skippedNote = r.skippedCount ? ` (${r.skippedCount} skipped.)` : "";
    if (r.error) {
      setMessage({
        type: "error",
        text: `Reassigned ${r.updatedCount} of ${ids.length} job(s) before an error: ${r.error} The rest are still selected — try again.${skippedNote}`,
      });
    } else {
      setMessage({
        type: "success",
        text: r.technicianName
          ? `Reassigned ${r.updatedCount} job(s) to ${r.technicianName}.${skippedNote}`
          : `Unassigned ${r.updatedCount} job(s).${skippedNote}`,
      });
    }
    router.refresh();
    setBusy(false);
  }

  // Dragging a card to a new column performs the same status-change action
  // as the existing controls: PATCH /api/repairs/bulk/status (the same
  // endpoint the bulk action bar above calls, and whose own comment already
  // earmarks it for this Kanban use) with a single-job ids array — same
  // role/ownership scoping, same StatusHistory + Receipt + AuditLog writes
  // as every other status change on this page. Not the single-job
  // PATCH /api/repairs/[id] route, which requires a full diagnosis/notes/
  // accessories payload this card doesn't have on hand.
  async function moveJobToStatus(job: WorkQueueJob, newStatus: (typeof STATUSES)[number]) {
    if (job.status === newStatus) return;
    setMovingId(job.id);
    setBoardError(null);
    try {
      const res = await fetch("/api/repairs/bulk/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [job.id], status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBoardError(data.error ?? "The status change could not be saved.");
        return;
      }
      if (!data.updated?.includes(job.id)) {
        setBoardError("That job could not be moved (no access, or it changed elsewhere first).");
        return;
      }
      // Same "offer to send it" convenience UpdateRepairForm already gives
      // on the device page — surface it here too so a drag on the Kanban
      // board doesn't require a separate trip to the device's WhatsApp tab.
      if (canSendWhatsapp && WHATSAPP_STATUSES.has(newStatus)) {
        setWhatsappPrompt({ jobId: job.id, hostname: job.hostname || "Device", status: newStatus });
      } else {
        setWhatsappPrompt(null);
      }
      router.refresh();
    } catch {
      setBoardError("Could not reach the server. Please try again.");
    } finally {
      setMovingId(null);
    }
  }

  // Shared by the list view and the Kanban board: the fixed bottom action
  // bar (bulk status change / reassign) shown while anything is selected, and
  // a plain notice for the result after the selection has been cleared (the
  // bar itself unmounts at that point, so its inline message can't be seen).
  const bulkBar =
    selectedCount > 0 ? (
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
    ) : null;

  const bulkNotice =
    selectedCount === 0 && message ? (
      <div
        className={`mt-4 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
          message.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
        }`}
        role={message.type === "error" ? "alert" : "status"}
      >
        <span>{message.text}</span>
        <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    ) : null;

  if (view === "board") {
    return (
      <div className={selectedCount > 0 ? "pb-24" : ""}>
        {bulkNotice}
        {boardError && (
          <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {boardError}
          </div>
        )}

        {whatsappPrompt && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <span className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 shrink-0" />
              {whatsappPrompt.hostname} moved to {whatsappPrompt.status}.
            </span>
            <div className="flex items-center gap-3">
              <Link
                href={`/devices/${whatsappPrompt.jobId}/whatsapp?type=${whatsappPrompt.status}`}
                className="btn-primary shrink-0 bg-emerald-600 px-3 py-1.5 text-xs hover:bg-emerald-700"
              >
                Send {whatsappPrompt.status} WhatsApp message
              </Link>
              <button
                type="button"
                onClick={() => setWhatsappPrompt(null)}
                className="text-emerald-700/70 hover:text-emerald-900"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {columns.map(({ status, jobs: colJobs }) => {
            const meta = COLUMN_META[status];
            const isDragTarget = dragOverStatus === status;
            return (
              <div
                key={status}
                onDragOver={(e) => {
                  if (draggingId === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverStatus !== status) setDragOverStatus(status);
                }}
                onDragLeave={() => setDragOverStatus((prev) => (prev === status ? null : prev))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStatus(null);
                  const draggedId = Number(e.dataTransfer.getData("text/plain"));
                  const job = jobs.find((j) => j.id === draggedId);
                  setDraggingId(null);
                  if (job) void moveJobToStatus(job, status);
                }}
                className={`rounded-3xl bg-white/50 p-3 backdrop-blur-xl transition-colors ${
                  isDragTarget ? "ring-2 ring-inset ring-brand-400 bg-brand-50/40" : ""
                }`}
              >
                <div className="mb-3 flex items-center justify-between px-1.5">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
                    {status}
                  </span>
                  <div className="flex items-center gap-2">
                    {isAdmin && colJobs.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleColumn(colJobs.map((j) => j.id))}
                        className="text-[11px] font-medium text-brand-600 hover:underline"
                      >
                        {colJobs.every((j) => selected.has(j.id)) ? "Deselect all" : "Select all"}
                      </button>
                    )}
                    <span className={`data-mono rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${meta.chip}`}>
                      {colJobs.length}
                    </span>
                  </div>
                </div>

                <div className="min-h-[80px] space-y-2.5">
                  {colJobs.map((d) => (
                    <div
                      key={d.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(d.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(d.id));
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverStatus(null);
                      }}
                      className={`card-interactive cursor-grab p-3.5 active:cursor-grabbing ${
                        d.overdue ? "ring-1 ring-inset ring-red-200" : ""
                      } ${selected.has(d.id) ? "ring-2 ring-inset ring-brand-400" : ""} ${
                        draggingId === d.id ? "opacity-40" : ""
                      } ${movingId === d.id ? "animate-pulse-soft" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                      {isAdmin && (
                        <input
                        type="checkbox"
                        checked={selected.has(d.id)}
                        onChange={() => toggle(d.id)}
                        className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-stone-300"
                        aria-label={`Select ${d.hostname || "device"}`}
                      />
                      )}
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
                  {colJobs.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-stone-400">
                      {isDragTarget ? "Drop here" : "No devices"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {jobs.length === 0 && (
          <div className="card mt-4 p-8 text-center text-sm text-stone-400">No devices match these filters.</div>
        )}

        <p className="mt-3 text-xs text-stone-400">
          {isAdmin
            ? "Drag a card to another column to change its status, or tick cards (or use Select all on a column) to change many at once. On touch devices, use the checkboxes or the Update link instead."
            : "Drag a card to another column to change its status. On touch devices, use the Update link instead."}
        </p>

        {bulkBar}
      </div>
    );
  }

  return (
    <div className={selectedCount > 0 ? "pb-24" : ""}>
      {bulkNotice}
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
                <div className="flex items-center gap-2">
                  {isAdmin && colJobs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleColumn(colJobs.map((j) => j.id))}
                      className="text-[11px] font-medium text-brand-600 hover:underline"
                    >
                      {colJobs.every((j) => selected.has(j.id)) ? "Deselect all" : "Select all"}
                    </button>
                  )}
                  <span className={`data-mono rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${meta.chip}`}>
                    {colJobs.length}
                  </span>
                </div>
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
                      {isAdmin && (
                        <input
                        type="checkbox"
                        checked={selected.has(d.id)}
                        onChange={() => toggle(d.id)}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-stone-300"
                        aria-label={`Select ${d.hostname || "device"}`}
                      />
                      )}
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

      {bulkBar}
    </div>
  );
}
