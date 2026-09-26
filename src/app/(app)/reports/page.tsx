import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Ported from app/pages/reports/reports.php. Admin only (requireRoles(['Admin'])
 * in the original). "Export PDF" now hits GET /api/reports/export-pdf, which
 * builds a real .pdf with pdfkit (see src/lib/reports/generate-report-pdf.ts) —
 * the original shelled out to a PHP PDF library with no equivalent here, but
 * that gap is closed now.
 */
function formatAuditAction(action: string) {
  return action
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "Admin") redirect("/dashboard");

  const params = await searchParams;
  const search = (params.search ?? "").trim();

  const [repairJobs, statusHistory, receipts, whatsappLogs, auditLogs, deletions, recentAuditLogs] =
    await Promise.all([
      prisma.repairJob.count(),
      prisma.statusHistory.count(),
      prisma.receipt.count(),
      prisma.whatsappLog.count(),
      prisma.auditLog.count(),
      prisma.auditLog.count({ where: { actionType: { contains: "delete", mode: "insensitive" } } }),
      prisma.auditLog.findMany({
        where: search
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
          : {},
        include: { performer: true },
        orderBy: [{ performedAt: "desc" }, { id: "desc" }],
        take: 10,
      }),
    ]);

  const stats = [
    { label: "Repair Jobs", value: repairJobs },
    { label: "Status Changes", value: statusHistory },
    { label: "Receipt Records", value: receipts },
    { label: "WhatsApp Logs", value: whatsappLogs },
    { label: "Audit Events", value: auditLogs },
    { label: "Deletion Records", value: deletions },
  ];

  return (
    <main className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Operational Intelligence
          </p>
          <h1 className="mt-1 text-lg font-semibold text-stone-900">Reports and History</h1>
          <p className="mt-1 max-w-xl text-sm text-stone-500">
            Review repair activity, status changes, receipts, customer communications, deletions, and
            authorized system actions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/api/reports/export-pdf" className="btn-primary">
            Export PDF
          </a>
          <Link href="/audit-history" className="btn-primary">
            View Audit History
          </Link>
          <span className="text-xs font-bold uppercase tracking-wide text-stone-400">Admin Access Only</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-2xl font-bold text-stone-900">{s.value}</p>
            <p className="mt-1 text-xs font-medium text-stone-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card mt-6">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Recent Audit Activity</h2>
            <p className="mt-1 text-xs text-stone-500">
              {search !== ""
                ? "The ten latest matching actions. Overview totals above include all records."
                : "The ten latest important system actions."}
            </p>
            {search !== "" && (
              <Link
                href={`/audit-history?search=${encodeURIComponent(search)}`}
                className="mt-1 inline-block text-xs font-medium text-brand-600 hover:underline"
              >
                View all matching activity
              </Link>
            )}
          </div>
          <span className="text-xs font-bold uppercase tracking-wide text-stone-400">Secure History</span>
        </div>

        <form className="flex gap-3 border-b border-stone-100 p-4" method="GET">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search report activity…"
            className="input flex-1 min-w-[220px]"
          />
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>

        {recentAuditLogs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <ShieldCheck className="text-stone-300" size={32} aria-hidden />
            <p className="text-sm font-semibold text-stone-900">No audit activity recorded</p>
            <p className="max-w-sm text-sm text-stone-500">
              Important system activity will appear here after users perform recorded actions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Record Type</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Performed By</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Date &amp; Time</th>
                </tr>
              </thead>
              <tbody>
                {recentAuditLogs.map((log, index) => (
                  <tr key={log.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-3 text-xs text-stone-400">{index + 1}</td>
                    <td className="px-4 py-3 font-bold text-stone-900">
                      {formatAuditAction(log.actionType)}
                    </td>
                    <td className="px-4 py-3 text-stone-700">{formatAuditAction(log.recordType)}</td>
                    <td className="px-4 py-3">
                      {log.recordReference ? (
                        <span className="font-semibold text-stone-900">{log.recordReference}</span>
                      ) : (
                        <span className="text-xs text-stone-400">No reference</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-stone-900">
                      {log.performer?.fullName ?? "System or Former User"}
                    </td>
                    <td className="px-4 py-3 text-stone-500">
                      {log.reason || <span className="text-xs text-stone-400">No reason provided</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-stone-700">
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
        )}
      </div>
    </main>
  );
}
