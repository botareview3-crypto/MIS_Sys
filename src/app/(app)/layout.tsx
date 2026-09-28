import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const unreadNotifications = await prisma.notification.count({
    where: { recipientUserId: session.userId, isRead: false },
  });

  return (
    <AppShell session={session} unreadNotifications={unreadNotifications}>
      {children}
    </AppShell>
  );
}
