import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Plus, ArrowUpRight, Info } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getMyDashboardData } from "@/lib/my-jobs";
import { MyDevicesSection } from "@/components/dashboard/MyDevicesSection";

const STATUS_STEPS = [
  { key: "Received", label: "Received", note: "Waiting to be worked on" },
  { key: "Repairing", label: "Repairing", note: "Work in progress" },
  { key: "Ready", label: "Ready", note: "Awaiting collection" },
  { key: "Delivered", label: "Delivered", note: "Completed jobs" },
] as const;

// Labels for the recent-activity feed, keyed by the action_type strings
// this codebase actually writes (see docs/commit-log.md 2026-09-25 (11) —
// these have drifted from the original PHP app's CREATE/UPDATE/
// STATUS_CHANGE/etc. naming in earlier sessions). Anything not listed
// here falls back to a title-cased version of the raw key, same as the
// original's fallback for unrecognized types.
const ACTIVITY_LABELS: Record<string, string> = {
  CREATE: "Device registered",
  device_edited: "Device updated",
  device_deleted: "Device record deleted",
  repair_updated: "Repair information updated",
  technician_assigned: "Technician assigned",
  technician_reassigned: "Technician reassigned",
  user_created: "User created",
  user_edited: "User updated",
  user_reactivated: "User reactivated",
  user_deactivated: "User deactivated",
  password_reset: "Password updated",
};

function titleCaseFallback(actionType: string) {
  return actionType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatToday(d: Date) {
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const year = d.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

function formatTimestamp(d: Date) {
  return (
    d.toLocaleDateString("en-US", { day: "2-digit", month: "short" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isAdmin = session.role === "Admin";
  const canRegisterDevice = ["Admin", "Reception", "Technician"].includes(session.role);

  const myData = await getMyDashboardData(session.userId);

  let received = 0;
  let repairing = 0;
  let ready = 0;
  let delivered = 0;
  let latestLog: Prisma.AuditLogGetPayload<{ include: { performer: true } }> | null = null;

  if (isAdmin) {
    [received, repairing, ready, delivered, latestLog] = await Promise.all([
      prisma.repairJob.count({ where: { status: "Received" } }),
      prisma.repairJob.count({ where: { status: "Repairing" } }),
      prisma.repairJob.count({ where: { status: "Ready" } }),
      prisma.repairJob.count({ where: { status: "Delivered" } }),
      prisma.auditLog.findFirst({
        orderBy: [{ performedAt: "desc" }, { id: "desc" }],
        include: { performer: true },
      }),
    ]);
  }

  const statusCounts: Record<string, number> = {
    Received: received,
    Repairing: repairing,
    Ready: ready,
    Delivered: delivered,
  };
  const total = received + repairing + ready + delivered;
  const activeRepairs = statusCounts.Received + statusCounts.Repairing;
  const completedPercent = total > 0 ? Math.round((statusCounts.Delivered / total) * 100) : 0;

  // Resolve the device this audit entry points at, if any — mirrors the
  // LEFT JOIN repair_jobs ... COALESCE(rj.job_id, al.record_reference) in
  // the original query.
  let activity:
    | { label: string; jobLabel: string; actor: string | null; deviceId: number | null; when: Date }
    | null = null;
  if (latestLog) {
    let deviceId: number | null = null;
    let jobLabel = latestLog.recordReference ?? "";
    if (latestLog.recordType === "repair_job" && latestLog.recordId) {
      const rj = await prisma.repairJob.findUnique({
        where: { id: latestLog.recordId },
        select: { id: true, jobId: true },
      });
      if (rj) {
        deviceId = rj.id;
        jobLabel = rj.jobId ?? jobLabel;
      }
    }
    activity = {
      label: ACTIVITY_LABELS[latestLog.actionType] ?? titleCaseFallback(latestLog.actionType || "System action"),
      jobLabel,
      actor: latestLog.performer?.fullName ?? null,
      deviceId,
      when: latestLog.performedAt,
    };
  }

  const firstName = session.fullName.trim().split(/\s+/)[0] ?? session.fullName;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = formatToday(new Date());

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Welcome row */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
              Operations overview · {today}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              {greeting}, {firstName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Keep every repair moving with a clear view of intake, workshop progress, and delivery readiness.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/work-queue"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <ClipboardList className="mr-1.5 h-4 w-4" />
              Open Work Queue
            </Link>
            {canRegisterDevice && (
              <Link href="/devices/register" className="btn-primary">
                <Plus className="mr-1.5 h-4 w-4" />
                Register Device
              </Link>
            )}
          </div>
        </div>

        <MyDevicesSection statusCounts={myData.statusCounts} total={myData.total} jobs={myData.jobs} />

        {isAdmin && (
          <>
            <div>
              <h2 className="font-semibold text-slate-900">System Overview</h2>
              <p className="text-xs text-slate-500">All devices across every technician and status</p>
            </div>

            {/* Status strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Link href="/devices" className="card p-4 transition hover:shadow-md">
                <div className="text-2xl font-bold text-slate-900">{total}</div>
                <div className="mt-1 text-xs text-slate-500">Total Devices</div>
              </Link>
              {STATUS_STEPS.map((s) => (
                <Link key={s.key} href={`/devices?status=${s.key}`} className="card p-4 transition hover:shadow-md">
                  <div className="text-2xl font-bold text-slate-900">{statusCounts[s.key]}</div>
                  <div className="mt-1 text-xs text-slate-500">{s.label}</div>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.45fr_0.75fr]">
              {/* Repair flow */}
              <div className="card p-5">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-900">Repair flow</h2>
                    <p className="text-xs text-slate-500">Current volume across the service lifecycle</p>
                  </div>
                  <Link
                    href="/devices"
                    className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                  >
                    View all devices <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {STATUS_STEPS.map((s) => (
                    <Link key={s.key} href={`/devices?status=${s.key}`} className="text-center">
                      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                        {statusCounts[s.key]}
                      </div>
                      <div className="text-xs font-semibold text-slate-900">{s.label}</div>
                      <div className="mt-0.5 hidden text-[11px] text-slate-500 sm:block">{s.note}</div>
                    </Link>
                  ))}
                </div>

                {statusCounts.Received > 0 && (
                  <div className="mt-6 flex items-start gap-2 rounded-lg border-l-4 border-brand-600 bg-slate-50 p-3 text-xs text-slate-600">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" />
                    <span>
                      <strong>Today&rsquo;s focus:</strong> {statusCounts.Received} device
                      {statusCounts.Received !== 1 ? "s" : ""} waiting to be worked on. Assign the oldest records
                      first to keep the queue moving.
                    </span>
                  </div>
                )}
              </div>

              {/* Recent activity */}
              <div className="card flex flex-col p-5">
                <div className="mb-4">
                  <h2 className="font-semibold text-slate-900">Recent activity</h2>
                  <p className="text-xs text-slate-500">Latest update from the team</p>
                </div>

                {activity ? (
                  <ActivityCard activity={activity} />
                ) : (
                  <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <Info className="h-4 w-4" />
                    </div>
                    <div>
                      <strong className="block text-sm text-slate-900">No recent activity</strong>
                      <p className="mt-0.5 text-xs text-slate-500">Actions will appear here as the system is used.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Operations pulse */}
            <div className="card p-5">
              <div className="flex flex-wrap items-center gap-5">
                <div
                  className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full"
                  style={{ background: `conic-gradient(rgb(37 100 180) ${completedPercent * 3.6}deg, #dce8f0 0deg)` }}
                >
                  <div className="absolute inset-1.5 rounded-full bg-white" />
                  <strong className="relative z-10 text-xs font-extrabold text-slate-900">{completedPercent}%</strong>
                </div>
                <div className="min-w-[220px] flex-1">
                  <strong className="block text-sm text-slate-900">Operations Pulse</strong>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {activeRepairs} active repair{activeRepairs === 1 ? "" : "s"} in progress. {statusCounts.Ready}{" "}
                    device
                    {statusCounts.Ready === 1 ? " is" : "s are"} ready for collection.
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-lg font-extrabold text-slate-900">{statusCounts.Delivered}</div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Delivered</div>
                  </div>
                  <div>
                    <div className="text-lg font-extrabold text-slate-900">{statusCounts.Ready}</div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-500">Ready</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function ActivityCard({
  activity,
}: {
  activity: { label: string; jobLabel: string; actor: string | null; deviceId: number | null; when: Date };
}) {
  const inner = (
    <>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <ClipboardList className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <strong className="block text-sm text-slate-900">{activity.label}</strong>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {activity.jobLabel}
          {activity.actor ? ` · ${activity.actor}` : ""}
        </p>
        <time className="mt-1 block text-[11px] text-slate-400">{formatTimestamp(activity.when)}</time>
      </div>
    </>
  );

  const className =
    "flex items-start gap-3 rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-3 transition";

  if (activity.deviceId) {
    return (
      <Link href={`/devices/${activity.deviceId}`} className={`${className} hover:bg-slate-50`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
