import Link from "next/link";
import { History, AlertTriangle } from "lucide-react";
import { isJobOverdue } from "@/lib/repair-overdue";

const STATUS_DOT: Record<string, string> = {
  Received: "bg-status-received",
  Diagnosing: "bg-status-diagnosing",
  Repairing: "bg-status-repairing",
  Ready: "bg-status-ready",
  Delivered: "bg-status-delivered",
};

type RecentJob = {
  id: number;
  jobId: string;
  hostname: string | null;
  status: string;
  expectedCompletionDate: Date | null;
  customer: { fullName: string };
};

/**
 * Item 8: a short "jump back in" strip for whoever's bouncing between a
 * handful of open jobs — most useful for technicians, but shown for any
 * role with a non-empty list rather than gated to Technician specifically,
 * since Reception/Admin can find it just as handy. Fed by the
 * `arp_recent_devices` cookie (see src/lib/recently-viewed.ts) rather than
 * a DB table. Renders nothing when the list is empty, so a first-time
 * user (or a fresh browser) doesn't see an empty shell.
 */
export function RecentlyViewedSection({ jobs }: { jobs: RecentJob[] }) {
  if (jobs.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        <History className="h-4 w-4 text-stone-400" aria-hidden />
        <h2 className="font-display text-sm font-semibold text-ink">Recently viewed</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {jobs.map((job) => {
          const overdue = isJobOverdue(job);
          return (
            <Link
              key={job.id}
              href={`/devices/${job.id}`}
              className={`flex min-w-[200px] shrink-0 flex-col gap-1 rounded-2xl border bg-white/60 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-candy ${
                overdue ? "border-red-200" : "border-stone-100"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[job.status] ?? "bg-brand-500"}`} aria-hidden />
                {overdue && (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-red-700">
                    <AlertTriangle className="h-3 w-3" />
                    Overdue
                  </span>
                )}
              </div>
              <p className="truncate text-sm font-medium text-stone-900">{job.hostname || "Unnamed device"}</p>
              <p className="truncate text-xs text-stone-500">{job.customer.fullName}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
