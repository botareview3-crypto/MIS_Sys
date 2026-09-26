import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { STATUS_KEYS } from "@/lib/my-jobs";

type MyJob = {
  id: number;
  jobId: string;
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
        <h2 className="font-semibold text-slate-900">Your Devices</h2>
        <p className="text-xs text-slate-500">
          Devices you registered or that are assigned to you — {total} total.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUS_KEYS.map((s) => (
          <Link key={s} href={`/devices?status=${s}`} className="card p-3 transition hover:shadow-md">
            <div className="text-xl font-bold text-slate-900">{statusCounts[s] ?? 0}</div>
            <div className="mt-0.5 text-xs text-slate-500">{s}</div>
          </Link>
        ))}
      </div>

      <div className="card p-5">
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing assigned to you yet. Devices you register or that get assigned to you will show up here.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {jobs.map((job) => (
              <li key={job.id} className="px-1">
                <Link
                  href={`/devices/${job.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-5 first:pt-2 last:pb-2 hover:bg-slate-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{job.jobId}</p>
                    <p className="truncate text-xs text-slate-500">
                      {job.customer.fullName} · {formatDate(job.receivedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
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
