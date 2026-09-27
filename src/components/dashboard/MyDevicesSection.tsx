import Link from "next/link";
import { Laptop, AlertTriangle } from "lucide-react";
import { STATUS_KEYS } from "@/lib/my-jobs";
import { isJobOverdue } from "@/lib/repair-overdue";

const STATUS_DOT: Record<string, string> = {
  Received: "bg-status-received",
  Repairing: "bg-status-repairing",
  Ready: "bg-status-ready",
  Delivered: "bg-status-delivered",
};

type MyJob = {
  id: number;
  jobId: string;
  hostname: string | null;
  status: string;
  receivedAt: Date;
  expectedCompletionDate: Date | null;
  customer: { fullName: string };
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

export function MyDevicesSection({
  statusCounts,
  total,
  jobs,
  overdueCount = 0,
}: {
  statusCounts: Record<string, number>;
  total: number;
  jobs: MyJob[];
  overdueCount?: number;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display font-semibold text-ink">Your Devices</h2>
          <p className="text-xs text-stone-500">
            Devices you registered or that are assigned to you — {total} total.
          </p>
        </div>
        {overdueCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            {overdueCount} overdue
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_KEYS.map((s) => (
          <Link key={s} href={`/devices?status=${s}`} className="stat-chip">
            <div
              className={`absolute -right-5 -top-5 h-16 w-16 rounded-full ${STATUS_DOT[s]} opacity-10`}
              aria-hidden
            />
            <div className="relative flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} aria-hidden />
              <div className="text-xl font-bold text-ink">{statusCounts[s] ?? 0}</div>
            </div>
            <div className="relative mt-0.5 text-xs text-stone-500">{s}</div>
          </Link>
        ))}
      </div>

      <div className="card p-5">
        {jobs.length === 0 ? (
          <p className="text-sm text-stone-500">
            Nothing assigned to you yet. Devices you register or that get assigned to you will show up here.
          </p>
        ) : (
          <ul className="space-y-3">
            {jobs.map((job) => {
              const overdue = isJobOverdue(job);
              return (
                <li key={job.id}>
                  <Link
                    href={`/devices/${job.id}`}
                    className={`flex items-center gap-3 rounded-2xl border bg-white/60 px-3 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-candy ${
                      overdue ? "border-red-200" : "border-stone-100"
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
                      <Laptop className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">{job.hostname || "Unnamed device"}</p>
                      <p className="truncate text-xs text-stone-500">
                        {job.customer.fullName} · {formatDate(job.receivedAt)}
                      </p>
                    </div>
                    {overdue && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700">
                        <AlertTriangle className="h-3 w-3" />
                        Overdue
                      </span>
                    )}
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm ${STATUS_DOT[job.status] ?? "bg-brand-500"}`}>
                      {job.status}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
