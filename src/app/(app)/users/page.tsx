import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRowActions } from "@/components/users/UserRowActions";

export default async function ManageUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "Admin") redirect("/dashboard");

  const params = await searchParams;
  const search = (params.search ?? "").trim();

  const [totalUsers, totalAdmins, totalReception, totalTechnicians, users] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, role: { in: ["Admin", "Secondary Admin"] } } }),
    prisma.user.count({ where: { deletedAt: null, role: "Reception" } }),
    prisma.user.count({ where: { deletedAt: null, role: "Technician" } }),
    prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: "insensitive" } },
                { username: { contains: search, mode: "insensitive" } },
                { role: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ fullName: "asc" }],
    }),
  ]);

  const roleOrder: Record<string, number> = { Admin: 1, "Secondary Admin": 2, Reception: 3, Technician: 4 };
  const sortedUsers = [...users].sort((a, b) => {
    const diff = (roleOrder[a.role] ?? 5) - (roleOrder[b.role] ?? 5);
    return diff !== 0 ? diff : a.fullName.localeCompare(b.fullName);
  });

  return (
    <main className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-stone-900">Manage Users</h1>
          <p className="mt-1 text-sm text-stone-500">{totalUsers} account(s)</p>
        </div>
        <Link href="/users/add" className="btn-primary">
          Add user
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
          Admins: {totalAdmins}
        </span>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
          Reception: {totalReception}
        </span>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
          Technicians: {totalTechnicians}
        </span>
      </div>

      <form className="card mt-6 flex gap-3 p-4" method="GET">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search by name, username, or role…"
          className="input flex-1"
        />
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((u) => (
              <tr key={u.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-3 font-medium text-stone-900">
                  {u.fullName}
                  {u.isMainAdmin && (
                    <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      Main Admin
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-stone-500">{u.username}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      u.isActive ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
                    }`}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <UserRowActions
                    userId={u.id}
                    fullName={u.fullName}
                    role={u.role}
                    isActive={u.isActive}
                    isSelf={u.id === session.userId}
                  />
                </td>
              </tr>
            ))}
            {sortedUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                  No user accounts match this search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
