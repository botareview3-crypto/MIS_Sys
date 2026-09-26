import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RepairJobWhereInput = any;

const STATUSES = ["Received", "Repairing", "Ready", "Delivered"] as const;
const PAGE_SIZE = 10;

export default async function ManageDevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; technician?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const search = (params.search ?? "").trim();
  const statusFilter = STATUSES.includes(params.status as (typeof STATUSES)[number]) ? params.status! : "";
  const technicianFilter = /^\d+$/.test(params.technician ?? "") ? Number(params.technician) : null;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const isSecondaryAdmin = session.role === "Secondary Admin";
  const isTechnicianRole = session.role === "Technician";

  const where: RepairJobWhereInput = {
    ...(isSecondaryAdmin ? { assignedSecondaryAdminId: session.userId } : {}),
    ...(!isTechnicianRole && technicianFilter ? { assignedTechnicianId: technicianFilter } : {}),
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

  const [totalRecords, devices, technicians] = await Promise.all([
    prisma.repairJob.count({ where }),
    prisma.repairJob.findMany({
      where,
      include: { customer: true, technician: true },
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.findMany({
      where: { role: "Technician", isActive: true, deletedAt: null },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));

  const buildUrl = (overrides: Record<string, string>) => {
    const sp = new URLSearchParams({
      ...(search ? { search } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(technicianFilter ? { technician: String(technicianFilter) } : {}),
      page: String(page),
      ...overrides,
    });
    return `/devices?${sp.toString()}`;
  };

  return (
    <main className="p-8">
      <h1 className="text-lg font-semibold text-slate-900">Manage Devices</h1>
      <p className="mt-1 text-sm text-slate-500">{totalRecords} device(s) found</p>

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
        {!isTechnicianRole && (
          <select name="technician" defaultValue={technicianFilter ?? ""} className="input w-48">
            <option value="">All technicians</option>
            {technicians.map((t: { id: number; fullName: string }) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className="btn-primary">
          Filter
        </button>
      </form>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Job ID</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Barcode / Serial</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Technician</th>
              <th className="px-4 py-3">Received</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d: (typeof devices)[number]) => (
              <tr key={d.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">
                  <Link href={`/devices/${d.id}`} className="text-brand-600 hover:underline">
                    {d.jobId}
                  </Link>
                </td>
                <td className="px-4 py-3">{d.customer.fullName}</td>
                <td className="px-4 py-3 text-slate-500">
                  {d.aucAssetBarcode} / {d.serialNumber}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                    {d.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{d.technician?.fullName ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{d.receivedAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No devices match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <Link
            href={buildUrl({ page: String(Math.max(1, page - 1)) })}
            className={`rounded-md px-3 py-1.5 ${page <= 1 ? "pointer-events-none text-slate-300" : "text-brand-600 hover:bg-brand-50"}`}
          >
            Previous
          </Link>
          <span className="text-slate-500">
            Page {page} of {totalPages}
          </span>
          <Link
            href={buildUrl({ page: String(Math.min(totalPages, page + 1)) })}
            className={`rounded-md px-3 py-1.5 ${page >= totalPages ? "pointer-events-none text-slate-300" : "text-brand-600 hover:bg-brand-50"}`}
          >
            Next
          </Link>
        </div>
      )}
    </main>
  );
}
