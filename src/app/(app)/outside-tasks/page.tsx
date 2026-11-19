import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prismaOutside, outsideTasksConfigured } from "@/lib/prisma-outside";
import { LogOutsideTaskForm } from "@/components/outside-tasks/LogOutsideTaskForm";
import { OUTSIDE_TASK_ISSUES, canViewAllOutsideTasks, formatLoggedAt } from "@/lib/outside-tasks";

export default async function OutsideTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const viewAll = canViewAllOutsideTasks(session.role);
  const params = await searchParams;
  const staffId = viewAll && /^\d+$/.test(params.staff ?? "") ? Number(params.staff) : null;

  if (!outsideTasksConfigured) {
    return (
      <main className="p-8">
        <h1 className="text-lg font-semibold text-stone-900">Outside Tasks</h1>
        <div className="card mt-6 p-6 text-sm text-stone-500">
          Outside Tasks storage is not set up yet. An administrator needs to add the
          OUTSIDE_TASKS_DATABASE_URL setting.
        </div>
      </main>
    );
  }

  const [tasks, staff] = await Promise.all([
    prismaOutside.outsideTask.findMany({
      // Non-admin roles are ALWAYS limited to their own rows, whatever the URL says.
      where: viewAll ? (staffId ? { userId: staffId } : {}) : { userId: session.userId },
      orderBy: [{ loggedAt: "desc" }, { id: "desc" }],
      take: 300,
    }),
    viewAll
      ? prisma.user.findMany({
          where: { deletedAt: null },
          select: { id: true, fullName: true },
          orderBy: { fullName: "asc" },
        })
      : Promise.resolve([] as { id: number; fullName: string }[]),
  ]);

  return (
    <main className="p-8">
      <h1 className="text-lg font-semibold text-stone-900">Outside Tasks</h1>
      <p className="mt-1 text-sm text-stone-500">
        {viewAll
          ? "Work logged by staff outside the office."
          : "Log work you do outside the office. Only you and the admins can see your entries."}
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
        <section className="card h-fit p-5">
          <h2 className="mb-4 text-sm font-semibold text-stone-900">Log a task</h2>
          <LogOutsideTaskForm issues={OUTSIDE_TASK_ISSUES} />
        </section>

        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-900">
              {viewAll ? "All entries" : "My entries"}{" "}
              <span className="font-normal text-stone-500">({tasks.length})</span>
            </h2>
            {viewAll && (
              <form method="get" className="flex items-center gap-2">
                <select name="staff" defaultValue={staffId ? String(staffId) : ""} className="input !w-auto !py-1.5">
                  <option value="">All staff</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-primary !py-1.5">
                  Filter
                </button>
              </form>
            )}
          </div>

          {tasks.length === 0 ? (
            <p className="p-6 text-sm text-stone-500">No outside tasks logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    {viewAll && <th className="px-4 py-2.5 font-medium">Logged by</th>}
                    <th className="px-4 py-2.5 font-medium">Customer</th>
                    <th className="px-4 py-2.5 font-medium">Issue</th>
                    <th className="px-4 py-2.5 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {tasks.map((t) => (
                    <tr key={t.id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-stone-500">{formatLoggedAt(t.loggedAt)}</td>
                      {viewAll && <td className="px-4 py-3 text-stone-700">{t.userFullName}</td>}
                      <td className="px-4 py-3 font-medium text-stone-900">{t.customerName}</td>
                      <td className="px-4 py-3 text-stone-700">{t.issue}</td>
                      <td className="max-w-xs whitespace-pre-wrap px-4 py-3 text-stone-500">{t.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
