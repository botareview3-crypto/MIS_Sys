import Link from "next/link";
import { Laptop } from "lucide-react";
import { STATUS_KEYS } from "@/lib/my-jobs";

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
  customer: { fullName: string };
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

export function MyDevicesSection({
  statusCounts,
  total,
  jobs,
}: {
  statusCounts: Record<string, number>;
  total: number;
  jobs: MyJob[];
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-semibold text-ink">Your Devices</h2>
        <p className="text-xs text-stone-500">
          Devices you registered or that are assigned to you — {total} total.
        </p>
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
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/devices/${job.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-stone-100 bg-white/60 px-3 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-white hover:shadow-candy"
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
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm ${STATUS_DOT[job.status] ?? "bg-brand-500"}`}>
                    {job.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
