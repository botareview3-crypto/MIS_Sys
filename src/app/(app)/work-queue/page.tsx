import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RepairJobWhereInput = any;

const STATUSES = ["Received", "Repairing", "Ready", "Delivered"] as const;

// Literal Tailwind classes per column — kept as a lookup (rather than
// built with template strings) so the JIT content-scanner actually picks
// them up. Mirrors the same status-color key used everywhere else
// (StatusBadge, dashboard STATUS_STEPS, login legend).
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

export default async function WorkQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const isAdmin = session.role === "Admin";
  const isTechnician = session.role === "Technician";
  const isSecondaryAdmin = session.role === "Secondary Admin";
  const requiresAssignment = isSecondaryAdmin;
  const hasAccess = isAdmin || isTechnician || isSecondaryAdmin;

  if (!hasAccess) {
    return (
      <main className="p-8">
        <div className="card p-6 text-sm text-stone-500">
          Your role does not have access to the Work Queue.
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const search = (params.search ?? "").trim();
  const statusFilter = STATUSES.includes(params.status as (typeof STATUSES)[number]) ? params.status! : "";

  // Barcode scanners type the scanned code then send Enter, which submits
  // this search form. When the scanned value is an exact match for one
  // device's serial number, asset barcode, or hostname, skip the filtered
  // list entirely and jump straight to that device's full record.
  if (search) {
    const scanMatches = await prisma.repairJob.findMany({
      where: {
        ...(requiresAssignment
          ? isSecondaryAdmin
            ? { assignedSecondaryAdminId: session.userId }
            : { assignedTechnicianId: session.userId }
          : {}),
        OR: [
          { serialNumber: { equals: search, mode: "insensitive" } },
          { aucAssetBarcode: { equals: search, mode: "insensitive" } },
          { hostname: { equals: search, mode: "insensitive" } },
        ],
      },
      select: { id: true },
      take: 2,
    });
    if (scanMatches.length === 1) redirect(`/devices/${scanMatches[0].id}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    ...(requiresAssignment
      ? isSecondaryAdmin
        ? { assignedSecondaryAdminId: session.userId }
        : { assignedTechnicianId: session.userId }
      : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search
      ? {
          OR: [
            { aucAssetBarcode: { contains: search, mode: "insensitive" } },
            { serialNumber: { contains: search, mode: "insensitive" } },
            { hostname: { contains: search, mode: "insensitive" } },
            { customer: { fullName: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const activeWhere: RepairJobWhereInput = {
    status: { in: ["Received", "Repairing"] },
    ...(requiresAssignment
      ? isSecondaryAdmin
        ? { assignedSecondaryAdminId: session.userId }
        : { assignedTechnicianId: session.userId }
      : {}),
  };

  const [workQueue, activeJobs] = await Promise.all([
    prisma.repairJob.findMany({
      where,
      include: { customer: true, technician: true },
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      take: 200,
    }),
    prisma.repairJob.findMany({
      where: activeWhere,
      include: { customer: true, technician: true },
      orderBy: [{ expectedCompletionDate: "asc" }, { receivedAt: "asc" }, { id: "asc" }],
      take: 50,
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  // Overdue-first, then earliest deadline, then received order (mirrors the SQL ORDER BY).
  const sortedQueue = [...workQueue].sort((a, b) => {
    const aOverdue = a.expectedCompletionDate && a.expectedCompletionDate.toISOString().slice(0, 10) < today && a.status !== "Delivered";
    const bOverdue = b.expectedCompletionDate && b.expectedCompletionDate.toISOString().slice(0, 10) < today && b.status !== "Delivered";
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    const aDate = a.expectedCompletionDate?.getTime() ?? Infinity;
    const bDate = b.expectedCompletionDate?.getTime() ?? Infinity;
    if (aDate !== bDate) return aDate - bDate;
    const order = { Received: 1, Repairing: 2, Ready: 3, Delivered: 4 } as const;
    const aOrder = order[a.status as keyof typeof order] ?? 6;
    const bOrder = order[b.status as keyof typeof order] ?? 6;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.receivedAt.getTime() - b.receivedAt.getTime();
  });

  const currentQueueItem = activeJobs[0] ?? null;
  const remainingActiveJobs = activeJobs.length;

  const statusTotals: Record<string, number> = { Received: 0, Repairing: 0, Ready: 0, Delivered: 0 };
  for (const item of workQueue) {
    if (item.status in statusTotals) statusTotals[item.status]++;
  }

  return (
    <main className="p-8">
      <h1 className="text-lg font-semibold text-stone-900">Work Queue</h1>
      <p className="mt-1 text-sm text-stone-500">All Registered Devices</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(statusTotals).map(([status, count]) => (
          <span key={status} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
            {status}: {count}
          </span>
        ))}
      </div>

      {currentQueueItem && (
        <div className="card mt-6 border-l-4 border-l-brand-600 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
            Current focus · {remainingActiveJobs} active job(s)
          </p>
          <h2 className="mt-1 text-base font-semibold text-stone-900">
            {currentQueueItem.hostname || "Device"} — {currentQueueItem.customer.fullName}
          </h2>
          <p className="mt-1 text-sm text-stone-500">{currentQueueItem.reportedProblem}</p>
          <div className="mt-3 flex gap-2">
            <Link href={`/repairs/${currentQueueItem.id}`} className="btn-primary">
              Update repair
            </Link>
          </div>
        </div>
      )}

      <form className="card mt-6 flex flex-wrap gap-3 p-4" method="GET">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search hostname, serial, customer…"
          className="input flex-1 min-w-[220px]"
        />
        <select name="status" defaultValue={statusFilter} className="input w-40">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary">
          Filter
        </button>
      </form>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STATUSES.map((status) => {
          const meta = COLUMN_META[status];
          const jobs = sortedQueue.filter((d) => d.status === status);
          return (
            <div key={status} className="rounded-3xl bg-white/50 p-3 backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between px-1.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
                  {status}
                </span>
                <span
                  className={`data-mono rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${meta.chip}`}
                >
                  {jobs.length}
                </span>
              </div>

              <div className="min-h-[80px] space-y-2.5">
                {jobs.map((d) => {
                  const overdue =
                    d.expectedCompletionDate &&
                    d.expectedCompletionDate.toISOString().slice(0, 10) < today &&
                    d.status !== "Delivered";
                  return (
                    <div key={d.id} className="card-interactive p-3.5">
                      <Link href={`/devices/${d.id}`} className="block">
                        <strong className="block truncate text-sm text-ink">{d.hostname || "Device"}</strong>
                        <p className="mt-1 truncate text-xs text-stone-500">{d.customer.fullName}</p>
                        <p className="data-mono mt-0.5 truncate text-[11px] text-stone-400">
                          {d.serialNumber || d.aucAssetBarcode || "—"}
                        </p>
                      </Link>

                      <div className="mt-3 flex items-center justify-between">
                        <span
                          className={`text-[11px] ${overdue ? "font-semibold text-red-600" : "text-stone-400"}`}
                        >
                          {d.expectedCompletionDate
                            ? d.expectedCompletionDate.toISOString().slice(0, 10)
                            : "No deadline"}
                          {overdue ? " · overdue" : ""}
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

                      <div className="mt-2.5 flex gap-3 border-t border-stone-100 pt-2.5 text-xs">
                        <Link href={`/repairs/${d.id}`} className="font-medium text-brand-600 hover:underline">
                          Update
                        </Link>
                        {isAdmin && (
                          <Link
                            href={`/repairs/${d.id}/assign`}
                            className="font-medium text-brand-600 hover:underline"
                          >
                            Assign
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
                {jobs.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-stone-400">No devices</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sortedQueue.length === 0 && (
        <div className="card mt-4 p-8 text-center text-sm text-stone-400">
          No devices match these filters.
        </div>
      )}
    </main>
  );
}
