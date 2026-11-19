import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isJobOverdue } from "@/lib/repair-overdue";
import { WorkQueueBoard } from "@/components/work-queue/WorkQueueBoard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RepairJobWhereInput = any;

const STATUSES = ["Received", "Repairing", "Ready", "Delivered"] as const;

export default async function WorkQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; view?: string }>;
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
  const view = params.view === "board" ? "board" : "list";
  const baseQuery: Record<string, string> = {
    ...(search ? { search } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };
  const listHref = `?${new URLSearchParams({ ...baseQuery, view: "list" }).toString()}`;
  const boardHref = `?${new URLSearchParams({ ...baseQuery, view: "board" }).toString()}`;
  // Same role list the device-detail page's WhatsApp button already uses
  // (UpdateRepairForm's canSendWhatsapp, repairs/[id]/page.tsx) — Secondary
  // Admin excluded, matching the established WhatsApp-access pattern.
  // Reception can't reach Work Queue at all, but the expression is kept
  // identical to that other call site on purpose rather than hand-simplified.
  const canSendWhatsapp = (["Admin", "Reception", "Technician"] as string[]).includes(session.role);

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

  const [workQueue, activeJobs, technicianOptions] = await Promise.all([
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
    isAdmin
      ? prisma.user.findMany({
          where: { role: { in: ["Technician", "Admin"] }, isActive: true, deletedAt: null },
          select: { id: true, fullName: true, role: true },
          orderBy: { fullName: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // Overdue-first, then earliest deadline, then received order (mirrors the SQL ORDER BY).
  const sortedQueue = [...workQueue].sort((a, b) => {
    const aOverdue = isJobOverdue(a);
    const bOverdue = isJobOverdue(b);
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
  let overdueTotal = 0;
  for (const item of workQueue) {
    if (item.status in statusTotals) statusTotals[item.status]++;
    if (isJobOverdue(item)) overdueTotal++;
  }

  return (
    <main className="p-8">
      <h1 className="text-lg font-semibold text-stone-900">Work Queue</h1>
      <p className="mt-1 text-sm text-stone-500">All Registered Devices</p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusTotals).map(([status, count]) => (
            <span key={status} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
              {status}: {count}
            </span>
          ))}
          {overdueTotal > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              Overdue: {overdueTotal}
            </span>
          )}
        </div>

        <div className="flex rounded-full bg-stone-100 p-1 text-xs font-semibold">
          <Link
            href={listHref}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              view === "list" ? "bg-white text-ink shadow-sm" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            List
          </Link>
          <Link
            href={boardHref}
            className={`rounded-full px-3 py-1.5 transition-colors ${
              view === "board" ? "bg-white text-ink shadow-sm" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Board
          </Link>
        </div>
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
        <input type="hidden" name="view" value={view} />
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

      <WorkQueueBoard
        jobs={sortedQueue.map((d) => ({
          id: d.id,
          hostname: d.hostname,
          serialNumber: d.serialNumber,
          aucAssetBarcode: d.aucAssetBarcode,
          status: d.status,
          expectedCompletionDate: d.expectedCompletionDate,
          overdue: isJobOverdue(d),
          customer: { fullName: d.customer.fullName },
          technician: d.technician ? { id: d.technician.id, fullName: d.technician.fullName } : null,
        }))}
        isAdmin={isAdmin}
        technicianOptions={technicianOptions}
        view={view}
        canSendWhatsapp={canSendWhatsapp}
      />
    </main>
  );
}
