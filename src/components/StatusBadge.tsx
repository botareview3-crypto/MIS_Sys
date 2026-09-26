type RepairStatus = "Received" | "Diagnosing" | "Repairing" | "Ready" | "Delivered";

const CLASS_BY_STATUS: Record<RepairStatus, string> = {
  Received: "badge-status-received",
  Diagnosing: "badge-status-diagnosing",
  Repairing: "badge-status-repairing",
  Ready: "badge-status-ready",
  Delivered: "badge-status-delivered",
};

/**
 * Renders a repair job's status with the app-wide status color key
 * (see globals.css .badge-status-* and CLAUDE.md's five exact status
 * strings). Falls back to a neutral pill for any unrecognized value
 * rather than throwing, since status is often read from the DB.
 */
export function StatusBadge({ status }: { status: string }) {
  const className = CLASS_BY_STATUS[status as RepairStatus] ?? "badge-status border-stone-300 bg-stone-100 text-stone-600";
  return <span className={className}>{status}</span>;
}
