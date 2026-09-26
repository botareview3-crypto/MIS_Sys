import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { MarkAllReadButton } from "@/components/notifications/MarkAllReadButton";
import { BackLink } from "@/components/nav/BackLink";

/**
 * Ported from app/pages/notifications/notifications.php.
 * Available to every role (Admin, Secondary Admin, Reception, Technician) —
 * requireRoles() in the original allows all four, so this only needs a
 * session, no role gate.
 */
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const params = await searchParams;
  const search = (params.search ?? "").trim();

  const notifications = await prisma.notification.findMany({
    where: {
      recipientUserId: session.userId,
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { message: { contains: search, mode: "insensitive" } },
              { notificationType: { contains: search, mode: "insensitive" } },
              { recordReference: { contains: search, mode: "insensitive" } },
              { creator: { fullName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { creator: true },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <main className="p-8">
      {/* Opened from the bell icon in the top bar, present on every page —
          there's no single parent page, so this returns to wherever the
          user actually came from. */}
      <BackLink href="/dashboard" label="Back" useHistory />

      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Administration</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review important system activity requiring administrative awareness.
          </p>
        </div>
        {unreadCount > 0 && <MarkAllReadButton />}
      </div>

      <form className="card mt-6 flex gap-3 p-4" method="GET">
        <input
          type="text"
          name="search"
          defaultValue={search}
          placeholder="Search notifications…"
          className="input flex-1 min-w-[220px]"
        />
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      {notifications.length === 0 ? (
        <div className="card mt-4 flex flex-col items-center gap-2 p-12 text-center">
          <p className="text-sm font-semibold text-slate-900">
            {search !== "" ? "No matching notifications" : "No notifications yet"}
          </p>
          <p className="max-w-sm text-sm text-slate-500">
            Important system activity, including device records deleted by technicians, will appear here.
          </p>
        </div>
      ) : (
        <div className="card mt-4">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">All Notifications</h2>
            <p className="text-xs text-slate-500">
              {unreadCount} unread · {notifications.length} total
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                id={n.id}
                notificationType={n.notificationType}
                title={n.title}
                message={n.message}
                recordReference={n.recordReference}
                isRead={n.isRead}
                createdAt={n.createdAt.toISOString()}
                createdByName={n.creator?.fullName?.trim() || "System"}
              />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
