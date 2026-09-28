import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { loadHostnamesByJobId, withHostnames } from "@/lib/reference-labels";

export const dynamic = "force-dynamic";

/**
 * Recent notifications for the top bar bell dropdown (src/components/TopBar.tsx).
 * Available to every role, same as /notifications itself — no role gate,
 * just a session. Unread first, newest first, capped to a handful for the
 * dropdown; the full list still lives at /notifications ("See all").
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: { recipientUserId: session.userId },
    include: { creator: true },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 8,
  });

  const hostnames = await loadHostnamesByJobId(
    notifications.flatMap((n) => [n.title, n.message, n.recordReference]),
  );

  const unreadCount = await prisma.notification.count({
    where: { recipientUserId: session.userId, isRead: false },
  });

  return NextResponse.json({
    unreadCount,
    notifications: notifications.map((n) => ({
      id: n.id,
      notificationType: n.notificationType,
      title: withHostnames(n.title, hostnames),
      message: withHostnames(n.message, hostnames),
      recordReference: n.recordReference ? withHostnames(n.recordReference, hostnames) : null,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
      createdByName: n.creator?.fullName?.trim() || "System",
    })),
  });
}
