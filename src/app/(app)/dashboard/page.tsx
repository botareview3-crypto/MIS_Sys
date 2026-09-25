import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="p-8">
      <div className="card p-6">
        <h1 className="text-lg font-semibold text-slate-900">
          Welcome, {session.fullName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Role: {session.role} — this is a placeholder. Devices, repairs, users,
          notifications, reports, and receipts pages are migrated next,
          feature by feature (see docs/status.md).
        </p>
      </div>
    </main>
  );
}
