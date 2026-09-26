import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const unreadNotifications = await prisma.notification.count({
    where: { recipientUserId: session.userId, isRead: false },
  });

  return (
    <div className="flex min-h-screen bg-stone-50">
      <Sidebar session={session} />
      <div className="flex-1 overflow-x-hidden">
        <TopBar unreadNotifications={unreadNotifications} />
        {children}
      </div>
    </div>
  );
}
