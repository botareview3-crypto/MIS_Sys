import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RepairJobWhereInput = any;

const STATUSES = ["Received", "Repairing", "Ready", "Delivered"] as const;

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

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Host Name</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Problem</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Deadline</th>
              <th className="px-4 py-3">Technician</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedQueue.map((d) => {
              const overdue =
                d.expectedCompletionDate &&
                d.expectedCompletionDate.toISOString().slice(0, 10) < today &&
                d.status !== "Delivered";
              return (
                <tr key={d.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-stone-900">{d.hostname || "—"}</td>
                  <td className="px-4 py-3">{d.customer.fullName}</td>
                  <td className="px-4 py-3 max-w-[240px] truncate text-stone-500">{d.reportedProblem}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                      {d.status}
                    </span>
                  </td>
                  <td className={`px-4 py-3 ${overdue ? "font-semibold text-red-600" : "text-stone-500"}`}>
                    {d.expectedCompletionDate ? d.expectedCompletionDate.toISOString().slice(0, 10) : "—"}
                    {overdue ? " · overdue" : ""}
                  </td>
                  <td className="px-4 py-3 text-stone-500">{d.technician?.fullName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/repairs/${d.id}`} className="text-brand-600 hover:underline">
                        Update
                      </Link>
                      {isAdmin && (
                        <Link href={`/repairs/${d.id}/assign`} className="text-brand-600 hover:underline">
                          Assign
                        </Link>
                      )}
                      <Link href={`/devices/${d.id}`} className="text-stone-400 hover:underline">
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {sortedQueue.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-stone-400">
                  No devices match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
