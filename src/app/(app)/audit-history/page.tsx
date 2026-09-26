import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Ported from app/pages/reports/audit-history.php. Admin only. */
function formatAuditLabel(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isValidDate(value: string) {
  if (value === "") return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

const RECORDS_PER_PAGE = 15;

export default async function AuditHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    action_type?: string;
    date_from?: string;
    date_to?: string;
    page?: string;
  }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "Admin") redirect("/dashboard");

  const params = await searchParams;
  const search = (params.search ?? "").trim();
  const actionFilter = (params.action_type ?? "").trim();
  let dateFrom = (params.date_from ?? "").trim();
  let dateTo = (params.date_to ?? "").trim();
  if (!isValidDate(dateFrom)) dateFrom = "";
  if (!isValidDate(dateTo)) dateTo = "";
  if (dateFrom !== "" && dateTo !== "" && dateFrom > dateTo) {
    [dateFrom, dateTo] = [dateTo, dateFrom];
  }

  let page = Number.parseInt(params.page ?? "1", 10);
  if (!Number.isInteger(page) || page < 1) page = 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    ...(search
      ? {
          OR: [
            { actionType: { contains: search, mode: "insensitive" } },
            { recordType: { contains: search, mode: "insensitive" } },
            { recordReference: { contains: search, mode: "insensitive" } },
            { reason: { contains: search, mode: "insensitive" } },
            { performer: { fullName: { contains: search, mode: "insensitive" } } },
            { performer: { username: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(actionFilter ? { actionType: actionFilter } : {}),
    ...(dateFrom || dateTo
      ? {
          performedAt: {
            ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  const [actionTypeRows, totalRecords] = await Promise.all([
    prisma.auditLog.findMany({
      where: { actionType: { not: "" } },
      select: { actionType: true },
      distinct: ["actionType"],
      orderBy: { actionType: "asc" },
    }),
    prisma.auditLog.count({ where }),
  ]);
  const actionTypes = actionTypeRows.map((r) => r.actionType);

  const totalPages = Math.max(1, Math.ceil(totalRecords / RECORDS_PER_PAGE));
  if (page > totalPages) page = totalPages;
  const offset = (page - 1) * RECORDS_PER_PAGE;

  const auditLogs = await prisma.auditLog.findMany({
    where,
    include: { performer: true },
    orderBy: [{ performedAt: "desc" }, { id: "desc" }],
    skip: offset,
    take: RECORDS_PER_PAGE,
  });

  function pageUrl(targetPage: number) {
    const qs = new URLSearchParams({ page: String(targetPage) });
    if (search) qs.set("search", search);
    if (actionFilter) qs.set("action_type", actionFilter);
    if (dateFrom) qs.set("date_from", dateFrom);
    if (dateTo) qs.set("date_to", dateTo);
    return `/audit-history?${qs.toString()}`;
  }

  return (
    <main className="p-8">
      <nav className="flex items-center gap-1.5 text-xs text-slate-400" aria-label="Breadcrumb">
        <span>AUC MIS</span>
        <ChevronRight size={12} aria-hidden />
        <Link href="/reports" className="hover:underline">
          Reports
        </Link>
        <ChevronRight size={12} aria-hidden />
        <span className="font-semibold text-slate-600">Audit History</span>
      </nav>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Secure System History
          </p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">Audit History</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Search and review important account, repair, assignment, credential, deletion, and system
            actions.
          </p>
        </div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} aria-hidden /> Back to Reports
        </Link>
      </div>

      <form method="GET" className="card mt-6 flex flex-wrap gap-3 p-4">
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Search here"
          className="input flex-1 min-w-[200px]"
        />
        <select name="action_type" defaultValue={actionFilter} className="input w-48">
          <option value="">All actions</option>
          {actionTypes.map((t) => (
            <option key={t} value={t}>
              {formatAuditLabel(t)}
            </option>
          ))}
        </select>
        <input type="date" name="date_from" defaultValue={dateFrom} className="input w-40" aria-label="Date from" />
        <input type="date" name="date_to" defaultValue={dateTo} className="input w-40" aria-label="Date to" />
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">
            Apply
          </button>
          <Link
            href="/audit-history"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear
          </Link>
        </div>
      </form>

      <div className="card mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Recorded System Activity</h2>
            <p className="mt-1 text-xs text-slate-500">
              {totalRecords} {totalRecords === 1 ? "matching event" : "matching events"}
            </p>
          </div>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Page {page} of {totalPages}
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <ShieldCheck className="text-slate-300" size={32} aria-hidden />
            <p className="text-sm font-semibold text-slate-900">No matching audit events found</p>
            <p className="max-w-sm text-sm text-slate-500">
              Try changing the search text, action type, or date range.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Record</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Performed By</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">IP Address</th>
                    <th className="px-4 py-3">Date &amp; Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, index) => (
                    <tr key={log.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 text-xs text-slate-400">{offset + index + 1}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {formatAuditLabel(log.actionType)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-700">{formatAuditLabel(log.recordType)}</div>
                        {log.recordId && (
                          <div className="mt-0.5 text-xs text-slate-400">Record ID: {log.recordId}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.recordReference ? (
                          <span className="font-semibold text-slate-900">{log.recordReference}</span>
                        ) : (
                          <span className="text-xs text-slate-400">No reference</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">
                          {log.performer?.fullName ?? "System or Former User"}
                        </div>
                        {log.performer?.username && (
                          <div className="mt-0.5 text-xs text-slate-400">@{log.performer.username}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {log.reason || <span className="text-xs text-slate-400">No reason provided</span>}
                      </td>
                      <td className="px-4 py-3">
                        {log.ipAddress ? (
                          <span className="font-semibold text-slate-900">{log.ipAddress}</span>
                        ) : (
                          <span className="text-xs text-slate-400">Not recorded</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {log.performedAt.toLocaleString(undefined, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <nav
                className="flex items-center gap-3 border-t border-slate-100 px-5 py-4"
                aria-label="Audit history pages"
              >
                {page > 1 ? (
                  <Link
                    href={pageUrl(page - 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <ChevronLeft size={14} aria-hidden /> Previous
                  </Link>
                ) : (
                  <span />
                )}
                <span className="flex-1 text-center text-xs font-semibold text-slate-500">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    href={pageUrl(page + 1)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Next <ChevronRight size={14} aria-hidden />
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
