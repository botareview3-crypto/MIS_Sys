import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [unreadNotifications, currentUser] = await Promise.all([
    prisma.notification.count({ where: { recipientUserId: session.userId, isRead: false } }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { profileImagePath: true } }),
  ]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        session={session}
        unreadNotifications={unreadNotifications}
        profileImagePath={currentUser?.profileImagePath ?? null}
      />
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
