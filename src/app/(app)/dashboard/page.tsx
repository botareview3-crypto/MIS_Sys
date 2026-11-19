import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { ClipboardList, Plus, ArrowUpRight, Info, AlertTriangle } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getMyDashboardData } from "@/lib/my-jobs";
import { MyDevicesSection } from "@/components/dashboard/MyDevicesSection";
import { RecentlyViewedSection } from "@/components/dashboard/RecentlyViewedSection";
import { overdueWhereClause } from "@/lib/repair-overdue";
import { RECENTLY_VIEWED_COOKIE, getRecentlyViewedDevices } from "@/lib/recently-viewed";

const STATUS_STEPS = [
  { key: "Received", label: "Received", note: "Waiting to be worked on", dot: "bg-status-received" },
  { key: "Repairing", label: "Repairing", note: "Work in progress", dot: "bg-status-repairing" },
  { key: "Ready", label: "Ready", note: "Awaiting collection", dot: "bg-status-ready" },
  { key: "Delivered", label: "Delivered", note: "Completed jobs", dot: "bg-status-delivered" },
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
  const recentCookie = (await cookies()).get(RECENTLY_VIEWED_COOKIE)?.value;
  const recentlyViewed = await getRecentlyViewedDevices(recentCookie, session);

  let received = 0;
  let repairing = 0;
  let ready = 0;
  let delivered = 0;
  let overdueTotal = 0;
  let latestLog: Prisma.AuditLogGetPayload<{ include: { performer: true } }> | null = null;

  if (isAdmin) {
    [received, repairing, ready, delivered, overdueTotal, latestLog] = await Promise.all([
      prisma.repairJob.count({ where: { status: "Received" } }),
      prisma.repairJob.count({ where: { status: "Repairing" } }),
      prisma.repairJob.count({ where: { status: "Ready" } }),
      prisma.repairJob.count({ where: { status: "Delivered" } }),
      prisma.repairJob.count({ where: overdueWhereClause() }),
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
        select: { id: true, jobId: true, hostname: true },
      });
      if (rj) {
        deviceId = rj.id;
        jobLabel = rj.hostname?.trim() || jobLabel;
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
        <div className="card animate-pop-in flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{today}</p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-gradient">
              {greeting}, {firstName} 👋
            </h1>
            <p className="mt-1.5 text-sm text-stone-500">
              Keep every repair moving with a clear view of intake, workshop progress, and delivery readiness.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/work-queue" className="btn-secondary">
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

        <MyDevicesSection
          statusCounts={myData.statusCounts}
          total={myData.total}
          jobs={myData.jobs}
          overdueCount={myData.overdueCount}
        />

        <RecentlyViewedSection jobs={recentlyViewed} />

        {isAdmin && (
          <>
            <div>
              <h2 className="font-display font-medium text-ink">System overview</h2>
              <p className="text-xs text-stone-500">All devices across every technician and status</p>
            </div>

            {/* Status strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Link href="/devices" className="card-interactive relative overflow-hidden p-4">
                <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-brand-gradient opacity-10" aria-hidden />
                <div className="data-mono relative text-2xl font-semibold text-ink">{total}</div>
                <div className="relative mt-1 text-xs text-stone-500">Total devices</div>
              </Link>
              {STATUS_STEPS.map((s) => (
                <Link key={s.key} href={`/devices?status=${s.key}`} className="card-interactive relative overflow-hidden p-4">
                  <div className={`absolute -right-4 -top-4 h-16 w-16 rounded-full ${s.dot} opacity-10`} aria-hidden />
                  <div className="relative flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${s.dot} shadow-sm`} aria-hidden />
                    <div className="data-mono text-2xl font-semibold text-ink">{statusCounts[s.key]}</div>
                  </div>
                  <div className="relative mt-1 text-xs text-stone-500">{s.label}</div>
                </Link>
              ))}
              <Link
                href="/work-queue"
                className={`card-interactive relative overflow-hidden p-4 ${overdueTotal > 0 ? "ring-1 ring-inset ring-red-200" : ""}`}
              >
                <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-red-500 opacity-10" aria-hidden />
                <div className="relative flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" aria-hidden />
                  <div className={`data-mono text-2xl font-semibold ${overdueTotal > 0 ? "text-red-600" : "text-ink"}`}>
                    {overdueTotal}
                  </div>
                </div>
                <div className="relative mt-1 text-xs text-stone-500">Overdue</div>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.45fr_0.75fr]">
              {/* Repair flow */}
              <div className="card p-5">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h2 className="font-display font-medium text-ink">Repair flow</h2>
                    <p className="text-xs text-stone-500">Current volume across the service lifecycle</p>
                  </div>
                  <Link
                    href="/devices"
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                  >
                    View all devices <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {STATUS_STEPS.map((s) => (
                    <Link key={s.key} href={`/devices?status=${s.key}`} className="text-center">
                      <div
                        className={`data-mono mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium text-white ${s.dot}`}
                      >
                        {statusCounts[s.key]}
                      </div>
                      <div className="text-xs font-medium text-ink">{s.label}</div>
                      <div className="mt-0.5 hidden text-[11px] text-stone-500 sm:block">{s.note}</div>
                    </Link>
                  ))}
                </div>

                {overdueTotal > 0 && (
                  <div className="mt-6 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />
                    <span>
                      <strong>{overdueTotal} job{overdueTotal !== 1 ? "s are" : " is"} past its expected completion
                      date</strong> and not yet Delivered.{" "}
                      <Link href="/work-queue" className="font-medium underline">
                        Review in Work Queue
                      </Link>
                      .
                    </span>
                  </div>
                )}

                {statusCounts.Received > 0 && (
                  <div className="mt-6 flex items-start gap-2 rounded-2xl border border-status-received/20 bg-status-received/5 p-3 text-xs text-stone-600">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-received" />
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
                  <h2 className="font-display font-medium text-ink">Recent activity</h2>
                  <p className="text-xs text-stone-500">Latest update from the team</p>
                </div>

                {activity ? (
                  <ActivityCard activity={activity} />
                ) : (
                  <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/50 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
                      <Info className="h-4 w-4" />
                    </div>
                    <div>
                      <strong className="block text-sm text-ink">No recent activity</strong>
                      <p className="mt-0.5 text-xs text-stone-500">Actions will appear here as the system is used.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Operations pulse */}
            <div className="card p-5">
              <div className="flex flex-wrap items-center gap-5">
                <div
                  className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full shadow-glow"
                  style={{ background: `conic-gradient(#7c3aed ${completedPercent * 3.6}deg, #ec489922 0deg)` }}
                >
                  <div className="absolute inset-1.5 rounded-full bg-white" />
                  <strong className="data-mono relative z-10 text-sm font-semibold text-gradient">{completedPercent}%</strong>
                </div>
                <div className="min-w-[220px] flex-1">
                  <strong className="block font-display text-sm font-medium text-ink">Operations pulse</strong>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {activeRepairs} active repair{activeRepairs === 1 ? "" : "s"} in progress. {statusCounts.Ready}{" "}
                    device
                    {statusCounts.Ready === 1 ? " is" : "s are"} ready for collection.
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <div className="data-mono text-lg font-medium text-ink">{statusCounts.Delivered}</div>
                    <div className="text-[11px] text-stone-500">Delivered</div>
                  </div>
                  <div>
                    <div className="data-mono text-lg font-medium text-ink">{statusCounts.Ready}</div>
                    <div className="text-[11px] text-stone-500">Ready</div>
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
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-glow">
        <ClipboardList className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <strong className="block text-sm text-ink">{activity.label}</strong>
        <p className="data-mono mt-0.5 truncate text-xs text-stone-500">
          {activity.jobLabel}
          {activity.actor ? ` \u00b7 ${activity.actor}` : ""}
        </p>
        <time className="mt-1 block text-[11px] text-stone-400">{formatTimestamp(activity.when)}</time>
      </div>
    </>
  );

  const className =
    "flex items-start gap-3 rounded-2xl border border-stone-100 bg-white/70 p-3 transition";

  if (activity.deviceId) {
    return (
      <Link href={`/devices/${activity.deviceId}`} className={`${className} hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-candy`}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
